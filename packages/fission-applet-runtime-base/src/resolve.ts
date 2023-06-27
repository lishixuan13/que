import {
  isFunction,
  isArray,
  isPlainObject,
  toHiddenShouldField,
  hasOwn,
} from './utils'
import { Instance, getVueInstance } from './instance'
import { callHook } from './lifecycle'
import { LifecycleHooks } from './enums'
import { isObject } from './utils'

interface LifecycleConfigObject {
  one?: boolean
  config?: string
  name: string
  lifecycle: LifecycleHooks
  origin?: (name: string, options: any, rootOptions: any) => any
}

interface LifecycleConfigDeepbject {
  deep: string
  names: Array<LifecycleConfigObject>
}

type LifecycleConfig = LifecycleConfigObject | LifecycleConfigDeepbject

export type FactoryOptions = Array<LifecycleConfig>

function createLifecycle(
  originLifecycle: Function | undefined,
  lifecycle: LifecycleHooks
): (...args: any[]) => void {
  return function (this: Instance, ...args: any[]) {
    callHook(this, lifecycle, args)

    if (originLifecycle !== undefined) {
      originLifecycle.call(this, ...args)
    }
  }
}

function createOneLifecycle(lifecycle: string) {
  return function (this: Instance, ...args: any[]) {
    const instance = getVueInstance(this)
    if (!instance) return {}
    const hook = instance[lifecycle]
    if (hook) {
      return hook(...args)
    }
    return {}
  }
}

function replaceLifecycle(
  lifecycleConfig: LifecycleConfig,
  options: any,
  rootOptions: any
) {
  const useConfig = rootOptions.useConfig
  if ('deep' in lifecycleConfig) {
    const { deep, names } = lifecycleConfig
    if (options[deep] === void 0) {
      options[deep] = {}
    }
    if (isPlainObject(options[deep])) {
      resolveLifecycle(names, options[deep], rootOptions)
    } else if (__DEV__) {
      console.warn(`options.${deep} is not an object`)
    }
  } else if ('config' in lifecycleConfig) {
    const { name, lifecycle, one, config: configName, origin } = lifecycleConfig
    const originLifecycle = origin
      ? origin(name, options, rootOptions)
      : options[name]
    // 例如分享等，只能存在一个函数
    if (one) {
      if (useConfig && useConfig[configName] && originLifecycle === undefined) {
        options[name] = createOneLifecycle(lifecycle)
        rootOptions[toHiddenShouldField(lifecycle)] = true
      }
    } else {
      // 例如scroll
      if ((useConfig && useConfig[configName]) || originLifecycle) {
        options[name] = createLifecycle(originLifecycle, lifecycle)
        rootOptions[toHiddenShouldField(lifecycle)] = true
      }
    }
  } else if ('name' in lifecycleConfig) {
    const { name, lifecycle, origin } = lifecycleConfig
    const originLifecycle = origin
      ? origin(name, options, rootOptions)
      : options[name]
    options[name] = createLifecycle(originLifecycle, lifecycle)
  }
}

export function resolveLifecycle(
  lifecycleOptions: FactoryOptions,
  options: any,
  rootOptions?: any
) {
  if (rootOptions === void 0) {
    rootOptions = options
  }
  if (isArray(lifecycleOptions)) {
    lifecycleOptions.forEach((name) => {
      replaceLifecycle(name, options, rootOptions)
    })
  }
}

export type Query = Record<string, string | undefined>

export type Options = Record<string, any>

export function resolveOptions<T, C>(
  optionsOrSetup: any
): {
  setup: T
  options: Options
} {
  let setup: T
  let options: Options

  const defaultConfig = {}

  if (getDefaultConfig('enablePageScroll')) {
    defaultConfig['listenPageScroll'] = true
  }

  if (isFunction(optionsOrSetup)) {
    setup = optionsOrSetup
    options = {}
    options.useConfig = defaultConfig as any
  } else {
    if (optionsOrSetup.setup === undefined) {
      // eslint-disable-next-line new-cap
      options = optionsOrSetup
      setup = null
      options.useConfig = Object.assign(defaultConfig, optionsOrSetup.useConfig)
    } else {
      const {
        setup: setupOption,
        useConfig: c,
        ...restOptions
      } = optionsOrSetup
      setup = setupOption
      options = restOptions
      options.useConfig = Object.assign(defaultConfig, c)
    }
  }
  if (
    options &&
    setup &&
    typeof setup === 'function' &&
    typeof options.data === 'function'
  ) {
    options.data = options.data()
  }
  return {
    setup,
    options,
  }
}

export const defaultGlobalConfig = {
  optimizePath: false,
  pageScrollConfig: false,
  errorHandler: null,
}

export interface GlobalConfig {
  optimizePath?: boolean
  enablePageScroll?: boolean
  errorHandler?: Function
}

export function setGlobalConfig(config: GlobalConfig) {
  Object.assign(defaultGlobalConfig, config)
}

export function getDefaultConfig(
  name: keyof GlobalConfig,
  instance?: Instance
) {
  return !instance ||
    !(
      isObject(instance.type.useConfig) && hasOwn(instance.type.useConfig, name)
    )
    ? defaultGlobalConfig[name]
    : instance.type?.useConfig[name]
}

const MARK_COMPOSITION = '__MARK_define_COMPOSITION__'

export function isComposition(obj: any) {
  return obj && obj[MARK_COMPOSITION]
}

export function markComposition(obj: any) {
  if (obj) {
    obj[MARK_COMPOSITION] = true
  }
}
