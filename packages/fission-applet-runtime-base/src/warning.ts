import { pauseTracking, resetTracking } from '@vue/reactivity'
import { Instance, formatComponentName } from './instance'
import { callWithErrorHandling, ErrorCodes } from './errorHandling'

const stack: Instance[] = []

export function pushWarningContext(vnode: Instance) {
  stack.push(vnode)
}

export function popWarningContext() {
  stack.pop()
}

export function warn(msg: string, ...args: any[]) {
  if (!__DEV__) return
  // avoid props formatting or warn handler tracking deps that might be mutated
  // during patch, leading to infinite recursion.
  pauseTracking()

  const instance = stack.length ? stack[stack.length - 1] : null
  const appWarnHandler = instance && instance.appContext?.config.warnHandler

  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      ErrorCodes.APP_WARN_HANDLER,
      [
        msg + args.join(''),
        instance && instance.proxy,
        `at <${formatComponentName(instance, instance.type)}>`,
      ]
    )
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args]
    /* istanbul ignore if */
    if (instance) {
      warnArgs.push(
        `\n`,
        `at <${formatComponentName(instance, instance.type)}>`
      )
    }
    console.warn(...warnArgs)
  }

  resetTracking()
}
