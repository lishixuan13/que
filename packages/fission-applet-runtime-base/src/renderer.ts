import { pauseTracking, resetTracking } from '@vue/reactivity'
import {
  Data,
  Instance,
  RenderPendingBranch,
  setCurrentInstance,
  unsetCurrentInstance,
  unloadInstance,
  currentInstance,
  clearRenderPendingBranch,
  getVueInstance,
} from './instance'
import { queueJob, queuePostFlushCb } from './scheduler'
import { isArray, isFunction } from './utils'
import { deepToRaw, deepWatch } from './shared'
import { getDefaultConfig } from './resolve'
import { isLifecycleHook } from './lifecycle'
import { clearRefIdValue } from './compileHelp'
import { diff, isSkip } from './diff'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'

const mergeMap = new Map<number, Record<string, any>>()

const padding = new Set<Instance>()

export function nextTickInstance(fn?: () => void, instance?: Instance) {
  return new Promise((resolve) => {
    if (
      instance &&
      (instance.currentRenderPendingBranch || instance.renderLoadingBranch)
    ) {
      queueEffectWithSuspense(
        () =>
          resolve(
            fn
              ? callWithAsyncErrorHandling(fn, instance, ErrorCodes.NEXTTICK)
              : null
          ),
        instance
      )
    } else {
      queueJob(() =>
        queueEffectWithSuspense(
          () =>
            resolve(
              fn
                ? callWithAsyncErrorHandling(fn, instance, ErrorCodes.NEXTTICK)
                : null
            ),
          instance
        )
      )
    }
  })
}

export function useNextTick(instance: Instance | null = currentInstance) {
  return (fn: () => void) => nextTickInstance(fn, instance)
}

export function mergeDataChange(key: string, nativeInstance: any) {
  const instance = getVueInstance(nativeInstance)
  let mergeObject = mergeMap.get(instance.uid)

  if (!mergeObject) {
    mergeMap.set(instance.uid, (mergeObject = {}))
  }

  mergeObject[key] = instance.setupState[key]
  padding.add(nativeInstance)
  instance.currentRenderPendingBranch = instance.currentRenderPendingBranch
    ? [].concat(instance.currentRenderPendingBranch)
    : []
  queueJob(runMergeData)
}

function runMergeData() {
  padding.forEach((nativeInstance) => {
    const instance = getVueInstance(nativeInstance)
    const currentRenderPendingBranch = clearRenderPendingBranch(instance)
    //   已经销毁就没必要接着更新数据了
    if (instance.scope && !instance.scope.active) {
      return
    }
    diffSetData(
      getUpdateData(nativeInstance),
      nativeInstance,
      currentRenderPendingBranch
    )
  })
  padding.clear()
}

function diffSetData(
  _data: any,
  nativeInstance: any,
  currentRenderPendingBranch: RenderPendingBranch,
  callback?: Function
) {
  // 优先取组件的配置
  if (
    nativeInstance.data &&
    getDefaultConfig('optimizePath', getVueInstance(nativeInstance))
  ) {
    const data = diff(_data, nativeInstance.data)
    if (isSkip(data)) {
      runRenderPendingBranch(currentRenderPendingBranch)
    } else {
      callInstanceSetData(
        nativeInstance,
        data,
        currentRenderPendingBranch,
        callback
      )
    }
  } else {
    callInstanceSetData(
      nativeInstance,
      _data,
      currentRenderPendingBranch,
      callback
    )
  }
}

function getUpdateData(nativeInstance: any) {
  const instance = getVueInstance(nativeInstance)
  const mergeObject = mergeMap.get(instance.uid)
  mergeMap.delete(instance.uid)
  const res = {}
  const __isScriptSetup = instance.setupState['__isScriptSetup']
  for (const k in mergeObject) {
    const value = mergeObject[k]
    if (isLifecycleHook(value)) return
    if (__isScriptSetup) {
      try {
        res[k] = deepToRaw(value)
      } catch (e) {
        nativeInstance[k] = value
      }
    } else {
      res[k] = deepToRaw(value)
    }
  }
  return res
}

export function queueEffectWithSuspense(
  fn: Function | Function[],
  instance: Instance
): void {
  const padding =
    instance &&
    (instance.currentRenderPendingBranch || instance.renderLoadingBranch)
  if (padding) {
    if (isArray(fn)) {
      padding.push(...fn)
    } else {
      padding.push(fn)
    }
  } else {
    queuePostFlushCb(fn)
  }
}

function isHideVar(name: string) {
  return name && name[0] === '_'
}

export function mount(nativeInstance: any, bindings: Data) {
  const instance = getVueInstance(nativeInstance)
  const initData = {}
  const __isScriptSetup = instance.setupState['__isScriptSetup']

  setCurrentInstance(instance)
  pauseTracking()
  Object.keys(bindings as object).forEach((key) => {
    const value = bindings[key]
    if (isLifecycleHook(value)) return
    if (isFunction(value)) {
      nativeInstance[key] = value
      return
    }

    if (__isScriptSetup) {
      if (isHideVar(key)) return
      try {
        const deepData = deepToRaw(value)
        initData[key] = deepData
        deepWatch(nativeInstance, key)
      } catch (e) {
        nativeInstance[key] = value
      }
      return
    }

    const deepData = deepToRaw(value)

    initData[key] = deepData
    deepWatch(nativeInstance, key)
  })
  resetTracking()
  unsetCurrentInstance()
  diffSetData(initData, nativeInstance, null, () => {
    instance.isMounted = true
  })
}

function callInstanceSetData(
  nativeInstance: any,
  data: any,
  currentRenderPendingBranch: RenderPendingBranch,
  callback?: Function
) {
  const instance = getVueInstance(nativeInstance)
  instance.renderLoadingBranch = instance.renderLoadingBranch
    ? [].concat(instance.renderLoadingBranch)
    : []
  nativeInstance.setData.call(nativeInstance, data, () => {
    isFunction(nativeInstance.__render_callback__) &&
      nativeInstance.__render_callback__()
    isFunction(callback) && callback()
    runRenderPendingBranch(currentRenderPendingBranch)
    const renderLoadingBranch = instance.renderLoadingBranch
    instance.renderLoadingBranch = null
    runRenderPendingBranch(renderLoadingBranch)
  })
}

function runRenderPendingBranch(
  currentRenderPendingBranch: RenderPendingBranch
) {
  if (currentRenderPendingBranch && currentRenderPendingBranch.length > 0) {
    queuePostFlushCb(currentRenderPendingBranch)
  }
}

export function unmount(nativeInstance: any) {
  const instance = getVueInstance(nativeInstance)
  clearRefIdValue(instance)
  unloadInstance(instance)
}

let a = 1

function handleClick() {
  a++
}
