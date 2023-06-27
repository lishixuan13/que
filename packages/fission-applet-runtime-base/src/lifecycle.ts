import { pauseTracking, resetTracking } from '@vue/reactivity'
import { InstanceType } from './enums'
import {
  Instance,
  setCurrentInstance,
  unsetCurrentInstance,
  currentInstance,
  getVueInstance,
} from './instance'
import { LifecycleHooks } from './enums'
import { toHiddenShouldField } from './utils'
import { callWithAsyncErrorHandling } from './errorHandling'

const normalHookWarn =
  'specific lifecycle injection APIs can only be used during execution of setup() in createPage() or createComponent() or defineApp().'

export function createConfigHook<
  T extends Function = (...args: unknown[]) => unknown
>(
  lifecycle: LifecycleHooks,
  hookName: string,
  config: string,
  injectPage = false
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (instance) {
        let flag = false
        if (injectPage && instance.instanceType === InstanceType.COMPONENT) {
          const page = instance.getCurrentPage()
          if (page && page.type?.[toHiddenShouldField(lifecycle)]) {
            injectHook(instance, lifecycle, hook, true)
            flag = true
          }
        } else if (instance.type?.[toHiddenShouldField(lifecycle)]) {
          injectHook(instance, lifecycle, hook)
          flag = true
        }
        if (!flag && __DEV__) {
          console.warn(
            `${hookName}() hook only works when '${config}' is configured to true.`
          )
        }
      } else if (__DEV__) {
        console.warn(normalHookWarn)
      }
    }
  )
}

export function createOneConfigHook<T extends (...args: unknown[]) => unknown>(
  lifecycle: LifecycleHooks,
  hookName: string,
  config: string
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (instance) {
        if (instance.type?.[toHiddenShouldField(lifecycle)]) {
          if (instance[lifecycle] === undefined) {
            instance[lifecycle] = hook
          } else if (__DEV__) {
            console.warn(`${hookName}() hook can only be called once.`)
          }
        } else if (__DEV__) {
          console.warn(
            `${hookName}() hook only works when '${hookName}' option is not exist and '${config}' is configured to true.`
          )
        }
      } else if (__DEV__) {
        console.warn(normalHookWarn)
      }
    }
  )
}

export function createAppHook<T extends (...args: unknown[]) => unknown>(
  lifecycle: LifecycleHooks
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (
        instance &&
        !(instance.instanceType !== InstanceType.APP && __DEV__)
      ) {
        injectHook(instance, lifecycle, hook)
      } else if (__DEV__) {
        console.warn(
          'App specific lifecycle injection APIs can only be used during execution of setup() in createApp().'
        )
      }
    }
  )
}

export function createPageHook<T extends (...args: unknown[]) => unknown>(
  lifecycle: LifecycleHooks,
  shouldComponentHook = false
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (
        instance &&
        !(
          instance.instanceType !== InstanceType.PAGE &&
          __DEV__ &&
          !shouldComponentHook
        )
      ) {
        if (
          shouldComponentHook &&
          instance.instanceType === InstanceType.COMPONENT
        ) {
          injectHook(instance, lifecycle, hook, true)
        } else {
          injectHook(instance, lifecycle, hook)
        }
      } else if (__DEV__) {
        console.warn(
          'Page specific lifecycle injection APIs can only be used during execution of setup() in createPage() or createComponent().'
        )
      }
    }
  )
}

export function createComponentHook<T extends (...args: unknown[]) => unknown>(
  lifecycle: LifecycleHooks
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (
        instance &&
        !(instance.instanceType !== InstanceType.COMPONENT && __DEV__)
      ) {
        injectHook(instance, lifecycle, hook)
      } else if (__DEV__) {
        console.warn(
          'Component specific lifecycle injection APIs can only be used during execution of setup() in createComponent().'
        )
      }
    }
  )
}

export function createtHook<T extends (...args: unknown[]) => unknown>(
  lifecycle: LifecycleHooks
) {
  return wrapHook(
    (hook: T, instance: Instance | null = currentInstance): void => {
      if (instance) {
        injectHook(instance, lifecycle, hook)
      } else if (__DEV__) {
        console.warn(
          'Component specific lifecycle injection APIs can only be used during execution of setup() in createComponent() or createPage().'
        )
      }
    }
  )
}

export function getComHiddenLifecycle(
  instance: Instance,
  lifecycle: LifecycleHooks,
  shouldNew = false
): Map<string, Function[]> {
  const comLifecycle = instance.componentsLifecycle
  if (!comLifecycle) {
    return null
  }
  return (
    comLifecycle[lifecycle] ||
    (shouldNew ? (comLifecycle[lifecycle] = new Map()) : null)
  )
}

function injectHook(
  instance: Instance | null = currentInstance,
  lifecycle: LifecycleHooks,
  hook: Function & { __weh?: Function },
  injectPage?: boolean
): Function | undefined {
  let hooks: Function[]
  if (injectPage) {
    const vid = instance.vid
    const pageInstance = instance.getCurrentPage()
    if (pageInstance) {
      const comLifecycle = getComHiddenLifecycle(pageInstance, lifecycle, true)
      if (comLifecycle) {
        hooks = comLifecycle.get(vid)
        if (!hooks) {
          comLifecycle.set(vid, (hooks = []))
        }
      }
    }
  } else {
    hooks = instance[lifecycle] || (instance[lifecycle] = [])
  }

  // cache the error handling wrapper for injected hooks so the same hook
  // can be properly deduped by the scheduler. "__weh" stands for "with error
  // handling".
  const wrappedHook =
    hook.__weh ||
    (hook.__weh = (...args: unknown[]) => {
      if (instance.isUnmounted) {
        return
      }
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking()
      // Set currentInstance during hook invocation.
      // This assumes the hook does not synchronously trigger other hooks, which
      // can only be false when the user does something really funky.
      setCurrentInstance(instance)
      const res = callWithAsyncErrorHandling(hook, instance, lifecycle, args)
      unsetCurrentInstance()
      resetTracking()
      return res
    })
  hooks.push(wrappedHook)
  return wrappedHook
}

export function callHook(
  currentInstance: Instance,
  lifecycle: LifecycleHooks,
  args?: unknown[]
) {
  const instance = getVueInstance(currentInstance)
  if (instance) {
    const hooks = instance[lifecycle]
    if (hooks) {
      hooks.forEach((hook: Function) => (args ? hook(...args) : hook()))
    }
    const comLifecycle = getComHiddenLifecycle(instance, lifecycle)
    if (comLifecycle && comLifecycle.size > 0) {
      comLifecycle.forEach((comHooks) => {
        if (comHooks && comHooks.forEach) {
          comHooks.forEach((hook: Function) => (args ? hook(...args) : hook()))
        }
      })
    }
  }
}

const LIFECYCLE_HOOK_FLAG = '__LIFECYCLE_HOOK_FLAG__'
export function isLifecycleHook(fn: unknown) {
  if (fn && fn[LIFECYCLE_HOOK_FLAG]) return true
  return false
}

function wrapHook<T extends Function>(
  fn: T
): T & { [LIFECYCLE_HOOK_FLAG]: true } {
  fn[LIFECYCLE_HOOK_FLAG] = true
  return fn as any
}
