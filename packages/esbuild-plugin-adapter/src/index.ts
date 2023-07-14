import type {
  PluginBuild as EsbuildPluginBuild,
  Plugin as EsbuildPlugin,
  OnLoadArgs,
  OnLoadResult,
} from 'esbuild'
import type {
  PluginBuild,
  Plugin,
  OnTransformOptions,
  OnTransformArgs,
  OnTransformResult,
  ResolveOptions,
} from './types'

export { EsbuildPluginBuild }
export {
  PluginBuild,
  OnTransformResult,
  OnTransformArgs,
  OnTransformOptions,
  Plugin,
  ResolveOptions,
}

interface TransformRegister {
  pluginName: string
  options: OnTransformOptions
  name: string
  callback: Function
}

const onlyCallbacks = ['onStart', 'onEnd', 'onDispose']

function createBuildContext(
  pluginName: string,
  build: EsbuildPluginBuild,
  transformRegisters: TransformRegister[]
) {
  const res = {} as PluginBuild
  res.onTransform = function (options, callback) {
    transformRegisters.push({
      pluginName,
      options,
      name: 'transform',
      callback,
    })
  }
  res.resolve = function (path, options) {
    const adapterSkipPlugin = []
    if (options.skipSelf) {
      adapterSkipPlugin.push(pluginName)
      delete options.skipSelf
    }
    return build.resolve(
      path,
      Object.assign({}, options, {
        pluginData: Object.assign({ adapterSkipPlugin }, options.pluginData),
      })
    )
  }

  res.onResolve = function (options, callback) {
    build.onResolve(options, async function (args) {
      if (args?.pluginData?.adapterSkipPlugin?.includes(pluginName)) {
        return null
      }
      return callback(args)
    })
  }

  function transform(
    onLoadArgs: OnLoadArgs,
    onLoadResult: OnLoadResult
  ): Promise<OnTransformResult> {
    return hookReduceTransformRegisters(
      onLoadResult,
      onLoadArgs,
      function (previous, result) {
        if (result && typeof result === 'object') {
          if (result.contents == null) {
            return previous
          }
          return result
        } else {
          return previous
        }
      },
      transformRegisters
    )
  }

  res.onLoad = function (options, callback) {
    build.onLoad(options, async function (args) {
      const loadResult = await callback(args)
      if (loadResult == null) return loadResult
      return transform(args, loadResult)
    })
  }

  onlyCallbacks.forEach((functionName) => {
    res[functionName] = function (callback: Function) {
      build[functionName](callback)
    }
  })

  return res
}

export function createAdapterPlugins(plugins: Plugin[]): EsbuildPlugin[] {
  const transformRegisters: TransformRegister[] = []
  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i]
    const originSetup = plugin.setup
    plugin.setup = function (build) {
      return originSetup.call(
        this,
        createBuildContext(plugin.name, build, transformRegisters)
      )
    }
  }
  return plugins
}

function hookReduceTransformRegisters(
  args: OnTransformArgs,
  onLoadArgs: OnLoadArgs,
  reduce: (
    reduction: OnTransformArgs,
    result: OnTransformResult,
    plugin: TransformRegister
  ) => OnTransformArgs,
  registers: TransformRegister[]
): Promise<OnTransformResult> {
  let promise = Promise.resolve(args)
  for (const register of registers) {
    if (
      register.options?.filter.test(onLoadArgs.path) &&
      (register?.options.namespace
        ? register?.options.namespace === onLoadArgs.namespace
        : true)
    ) {
      promise = promise.then((args) =>
        runHook([args, onLoadArgs], register).then((result) =>
          reduce(args, result, register)
        )
      )
    }
  }
  return promise
}

const unfulfilledActions = new Set()

function runHook(parameters: unknown[], register: TransformRegister) {
  const handler = register.callback
  let action: [string, string, Parameters<any>] | null = null
  return Promise.resolve()
    .then(() => {
      if (typeof handler !== 'function') {
        return handler
      }
      // eslint-disable-next-line @typescript-eslint/ban-types
      const hookResult = (handler as Function)(...parameters)

      if (!hookResult?.then) {
        // short circuit for non-thenables and non-Promises
        return hookResult
      }

      // Track pending hook actions to properly error out when
      // unfulfilled promises cause rollup to abruptly and confusingly
      // exit with a successful 0 return code but without producing any
      // output, errors or warnings.
      action = [register.pluginName, register.name, parameters]
      unfulfilledActions.add(action)

      // Although it would be more elegant to just return hookResult here
      // and put the .then() handler just above the .catch() handler below,
      // doing so would subtly change the defacto async event dispatch order
      // which at least one test and some plugins in the wild may depend on.
      return Promise.resolve(hookResult).then((result) => {
        // action was fulfilled
        unfulfilledActions.delete(action!)
        return result
      })
    })
    .catch((error_) => {
      if (action !== null) {
        // action considered to be fulfilled since error being handled
        unfulfilledActions.delete(action)
      }
      throw error_
    })
}
