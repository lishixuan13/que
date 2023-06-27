import { isPlainObject, isFunction } from './utils'
export type Target = Record<string, any>

type Before = (args: unknown[], name: PropertyKey) => any
type After = (result: unknown, args: unknown[], name: PropertyKey) => any
type AopError = (msg: Error, name: PropertyKey) => void

const SKIP = '__SKIP__AOP__'

export interface AopOpt {
  before?: Before
  after?: After
  error?: AopError
  shouldNew?: boolean
}

export interface AOPHideOpt {
  __aop_opt__: boolean
  options?: AopOptions
  other?: AopWrap
  shouldNew: boolean
}

export type AopWrap = Before | AopOpt

export type AopOptions = Record<PropertyKey, AopWrap | AOPHideOpt | null>

/**
 * 代理对象
 */
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions,
  other?: AopWrap,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  other: Before,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions | Before,
  other?: AopWrap | boolean,
  shouldNew?: boolean
): T {
  if (!isPlainObject(target)) return target
  if (isFunction(options)) {
    other = options
    options = null
  }
  // 多个参数other不传，直接shouldNew
  if (typeof other === 'boolean') {
    shouldNew = other
    other = undefined
  }
  const result: Record<PropertyKey, any> = {}
  Object.getOwnPropertyNames(target).forEach((k) => {
    let val = target[k]
    if (options && options.hasOwnProperty(k))
      val = proxyKey(target, (options as AopOptions)[k], k)
    else if (other) val = proxyKey(target, other as AopWrap, k)
    if (val === SKIP) {
      result[k] = target[k]
      return
    }
    result[k] = val
  })
  for (const k in options) {
    if (!target[k] && options[k]) {
      const proxyResult = proxyKey(target, options[k], k, shouldNew)
      if (proxyResult === SKIP) continue
      result[k] = proxyResult
    }
  }
  return result as T
}

export function aop(other: Before): AOPHideOpt
export function aop(options: AopOptions, shouldNew?: boolean)
export function aop(
  options: AopOptions,
  other?: AopWrap,
  shouldNew?: boolean
): AOPHideOpt
export function aop(
  options: AopOptions | Before,
  other?: AopWrap | boolean,
  shouldNew?: boolean
): AOPHideOpt {
  // 单个参数的情况
  if (isFunction(options)) {
    other = options
    options = null
  }
  // 多个参数other不传，直接shouldNew
  if (typeof other === 'boolean') {
    shouldNew = other
    other = undefined
  }
  return {
    options: options as AopOptions,
    other: other as AopWrap,
    __aop_opt__: true,
    shouldNew,
  }
}

/**
 * 获取 before 和 after 方法
 */
function getProxyObjFn(
  wrap: AopWrap,
  fatherShouldNew
): [Before, After, AopError, boolean] {
  let before = null
  let after = null
  let proxyError = null
  let shouldNew = fatherShouldNew
  if (typeof wrap === 'function') {
    before = wrap
  } else {
    before = wrap.before
    after = wrap.after
    proxyError = wrap.error
    if (typeof wrap.shouldNew === 'boolean') {
      shouldNew = wrap.shouldNew
    }
  }
  return [before, after, proxyError, shouldNew]
}

const isAopOpt = (v: any): v is AOPHideOpt => v && v.__aop_opt__

/**
 * 代理对象的key
 */
function proxyKey(
  target: Target,
  wrap: AopWrap | AOPHideOpt,
  k: string | number,
  fatherShouldNew?: boolean
): any {
  const method = target[k]
  if (!wrap) return method
  if (isAopOpt(wrap)) {
    return aopObject(method, wrap.options, wrap.other, wrap.shouldNew)
  }
  if (method !== void 0 && typeof method !== 'function') return method
  const [before, after, proxyError, shouldNew] = getProxyObjFn(
    wrap,
    fatherShouldNew
  )
  if (method === void 0) {
    if (typeof shouldNew === 'boolean') {
      if (!shouldNew) return SKIP
    } else if (!before && after) return SKIP
  }
  return function (...args: unknown[]) {
    let result = void 0
    if (before) {
      result = tryFn(before, this, [args, k], proxyError, k)
    }
    let shouldFinally = false
    if (method) {
      try {
        result = method.apply(this, args)
      } catch (e) {
        shouldFinally = true
        if (after) tryFn(after, this, [result, args, k], proxyError, k)
        try {
          proxyError(e, k)
        } catch (e) {}
        throw e
      }
    }
    if (!shouldFinally && after) {
      return tryFn(after, this, [result, args, k], proxyError, k)
    }
    return result
  }
}

function tryFn(
  fn: Function,
  context: any,
  args: unknown[],
  aopError: AopError,
  k: string | number
) {
  let result
  try {
    result = fn.apply(context, args)
  } catch (e) {
    if (typeof aopError === 'function') {
      try {
        aopError(e, k)
      } catch (e) {}
    }
  }
  return result
}

interface Hooks {
  app: Set<AOPHideOpt>
  page: Set<AOPHideOpt>
  component: Set<AOPHideOpt>
}

const globalHook: Hooks = {
  app: new Set(),
  page: new Set(),
  component: new Set(),
}

export type SetupAop = (globalHook: Hooks) => void

const privateHook: Hooks = {
  app: new Set(),
  page: new Set(),
  component: new Set(),
}

export function setupPrivateAOP(setup: SetupAop) {
  setup(privateHook)
}

export function setupAOP(setup: SetupAop) {
  setup(globalHook)
}

export function callAOP<T extends Record<string, any>>(
  name: keyof Hooks,
  target: T
) {
  target = callTarget(globalHook, name, target)
  target = callTarget(privateHook, name, target)
  return target
}

export function callSetupAfterAOP<T extends Record<string, any>>(
  name: keyof Hooks,
  target: T,
  hookChain?: string[]
) {
  target = callAfterTarget(globalHook, name, target, hookChain)
  target = callAfterTarget(privateHook, name, target, hookChain)
  return target
}

function callTarget<T extends Record<string, any>>(
  hooks: Hooks,
  name: keyof Hooks,
  target: T
) {
  hooks[name].forEach((hook) => {
    if (isAopOpt(hook)) {
      target = aopObject<T>(target, hook.options, hook.other, hook.shouldNew)
    } else if (__DEV__) {
      console.warn(
        `in ${name} hook is not an aopOpt object, you can call the aop method to create`
      )
    }
  })
  return target
}

function callAfterTarget<T extends Record<string, any>>(
  hooks: Hooks,
  name: keyof Hooks,
  target: T,
  hookChain?: string[]
) {
  hooks[name].forEach((hook) => {
    if (hookChain && hookChain.length > 0) {
      for (let index = 0; index < hookChain.length; index++) {
        if (!hook.options) return
        const _hook = hook.options[hookChain[index]]
        if (!isAopOpt(_hook)) return
        hook = _hook
      }
    }
    if (!hook) return
    if (isAopOpt(hook)) {
      target = aopObject<T>(target, hook.options, hook.other, false)
    } else if (__DEV__) {
      console.warn(
        `in ${name} hook is not an aopOpt object, you can call the aop method to create`
      )
    }
  })
  return target
}
