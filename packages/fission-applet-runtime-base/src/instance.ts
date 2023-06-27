import {
  EffectScope,
  ReactiveEffect,
  markRaw,
  isRef,
  shallowReadonly,
  pauseTracking,
  resetTracking,
  proxyRefs,
} from '@vue/reactivity'
import {
  ComponentPropsOptions,
  initProps,
  NormalizedPropsOptions,
} from './props'
import { AppContext, createAppContext } from './apiCreateApp'
import {
  EmitsOptions,
  ObjectEmitsOptions,
  EmitFn,
  getCurrentPage,
} from './emits'
import { EMPTY_OBJ, isFunction, isArray, isObject } from './utils'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { warn } from './warning'
import { PublicInstanceProxyHandlers } from './context'
import { LifecycleHooks, InstanceType } from './enums'

export type Data = Record<string, unknown>

export type InternalSlots = {
  [name: string]: boolean | undefined
}

export type Slots = Readonly<InternalSlots>

/**
 * Default allowed non-declared props on component in TSX
 */
export interface AllowedComponentProps {
  class?: unknown
  style?: unknown
}

// Note: can't mark this whole interface internal because some public interfaces
// extend it.
export interface ComponentInternalOptions {
  /**
   * @internal
   */
  __scopeId?: string
  /**
   * @internal
   */
  __cssModules?: Data
  /**
   * @internal
   */
  __hmrId?: string
  /**
   * Compat build only, for bailing out of certain compatibility behavior
   */
  __isBuiltIn?: boolean
  /**
   * This one should be exposed so that devtools can make use of it
   */
  __file?: string
  /**
   * name inferred from filename
   */
  __name?: string
}

export interface FunctionalComponent<P = {}, E extends EmitsOptions = {}>
  extends ComponentInternalOptions {
  // use of any here is intentional so it can be a valid JSX Element constructor
  (props: P, ctx: Omit<SetupContext<E>, 'expose'>): any
  props?: ComponentPropsOptions<P>
  emits?: E | (keyof E)[]
  inheritAttrs?: boolean
  displayName?: string
}

type LifecycleHook<TFn = Function> = TFn[] | null

// use `E extends any` to force evaluating type to fix #2362
export type SetupContext<E = EmitsOptions> = E extends any
  ? {
      attrs: Data
      slots: Slots
      emit: EmitFn<E>
      expose: (exposed?: Record<string, any>) => void
    }
  : never

export interface RenderBranch {
  id: number
  effects: Function[]
}

export type SlotsScope = Record<
  string,
  Record<string, { id: string; props: Record<string, unknown> }[]>
>

export type RenderPendingBranch = Function[] | null

/**
 * We expose a subset of properties on the internal instance as they are
 * useful for advanced external libraries and tools.
 */
export interface Instance {
  __IS_FISSION__: boolean
  vid: string
  uid: number
  type: any
  instanceType: InstanceType
  parent: Instance | null
  root: Instance
  appContext: AppContext
  /**
   * Render effect instance
   */
  effect: ReactiveEffect
  /**
   * SSR render function
   * @internal
   */
  ssrRender?: Function | null
  /**
   * Object containing values this component provides for its descendents
   * @internal
   */
  provides: Data
  /**
   * Tracking reactive effects (e.g. watchers) associated with this component
   * so that they can be automatically stopped on component unmount
   * @internal
   */
  scope: EffectScope
  /**
   * cache for proxy access type to avoid hasOwnProperty calls
   * @internal
   */
  accessCache: Data | null

  /**
   * Resolved component registry, only for components with mixins or extends
   * @internal
   */
  components: Record<string, any> | null

  /**
   * Resolved directive registry, only for components with mixins or extends
   * @internal
   */
  //   directives: Record<string, Directive> | null
  /**
   * Resolved filters registry, v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
  /**
   * resolved props options
   * @internal
   */
  propsOptions: NormalizedPropsOptions
  /**
   * resolved emits options
   * @internal
   */
  emitsOptions: ObjectEmitsOptions | null
  /**
   * resolved inheritAttrs options
   * @internal
   */
  inheritAttrs?: boolean
  /**
   * is custom element?
   * @internal
   */
  isCE?: boolean
  /**
   * custom element specific HMR method
   * @internal
   */
  ceReload?: (newStyles?: string[]) => void

  // the rest are only for stateful components ---------------------------------

  // main proxy that serves as the public instance (`this`)
  proxy: any | null

  // exposed properties via expose()
  exposed: Record<string, any> | null
  exposeProxy: Record<string, any> | null

  /**
   * alternative proxy used only for runtime-compiled render functions using
   * `with` block
   * @internal
   */
  withProxy: any | null
  /**
   * This is the target for the public instance proxy. It also holds properties
   * injected by user options (computed, methods etc.) and user-attached
   * custom properties (via `this.x = ...`)
   * @internal
   */
  ctx: Data

  // state
  data: Data
  props: Data
  attrs: Data
  slots: InternalSlots
  slotsScope: SlotsScope
  refs: Data
  emit: EmitFn
  createSelectorQuery?: (...args: unknown[]) => any
  createIntersectionObserver?: (...args: unknown[]) => any
  _helpRefs: Record<string, { key: string; isFunc: boolean }>

  props_update_promise: Promise<void> | null
  /**
   * methods
   */
  onLoadQuery: Data | null
  getCurrentPage: () => Instance
  getPageId: () => string
  /**
   * used for keeping track of .once event handlers on components
   * @internal
   */
  emitted: Record<string, boolean> | null
  /**
   * used for caching the value returned from props default factory functions to
   * avoid unnecessary watcher trigger
   * @internal
   */
  propsDefaults: Data
  /**
   * setup related
   * @internal
   */
  setupState: Data
  /**
   * devtools access to additional info
   * @internal
   */
  devtoolsRawSetupState?: any
  /**
   * @internal
   */
  setupContext: SetupContext | null

  currentRenderPendingBranch: RenderPendingBranch
  renderLoadingBranch: RenderPendingBranch

  /**
   * suspense related
   * @internal
   */
  // suspense: SuspenseBoundary | null
  /**
   * suspense pending batch id
   * @internal
   */
  //   suspenseId: number
  /**
   * @internal
   */
  asyncDep: Promise<any> | null
  /**
   * @internal
   */
  asyncResolved: boolean

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.CREATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UPDATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.SERVER_PREFETCH]: LifecycleHook<() => Promise<unknown>>

  componentsLifecycle: Record<string, Map<string, LifecycleHook>>
  /**
   * For caching bound $forceUpdate on public proxy access
   * @internal
   */
  f?: () => void
  /**
   * For caching bound $nextTick on public proxy access
   * @internal
   */
  n?: () => Promise<void>
  /**
   * `updateTeleportCssVars`
   * For updating css vars on contained teleports
   * @internal
   */
  ut?: (vars?: Record<string, string>) => void
}

let uid = 0

export const INSTANCE_VUE = 'fission_instance_vue_l'

export function getVueInstance(nativeInstance: any): Instance | undefined {
  if (!nativeInstance) return
  return nativeInstance['__IS_FISSION__']
    ? nativeInstance
    : nativeInstance[INSTANCE_VUE]
}

interface GlobalInstance {
  instance?: Instance
  instanceType: InstanceType
  callbacks: Function[]
}

function createGlobalInstance(instanceType: InstanceType) {
  return {
    instance: null,
    instanceType,
    callbacks: [],
  }
}

/** 保存全局页面实例 */
const GLOBAL_INSTANCE = new Map<string, GlobalInstance>()

export function createInstance(
  nativeInstance: any,
  instanceType: InstanceType,
  options: any,
  {
    propsOptions = [],
    emitsOptions = EMPTY_OBJ,
    rawProps,
    onLoadQuery,
    initCallback,
    appContext,
    getPageId,
    createSelectorQuery,
    createIntersectionObserver,
    emit,
  }: {
    propsOptions?: NormalizedPropsOptions
    emitsOptions?: ObjectEmitsOptions
    rawProps?: Data | null
    appContext?: AppContext
    onLoadQuery?: Data | null
    initCallback: (instance: Instance) => void
    getPageId: () => string
    createSelectorQuery?: (...args: unknown[]) => any
    createIntersectionObserver?: (...args: unknown[]) => any
    emit?: (event: string, ...rawArgs: any[]) => void
  }
) {
  const pageId = getPageId()

  const _uid = uid++

  const vid =
    instanceType === InstanceType.APP
      ? 'app'
      : instanceType === InstanceType.PAGE
      ? pageId
      : `com:${_uid}`

  if (isFunction(nativeInstance.setData)) {
    nativeInstance.setData({
      fission_vid: vid,
    })
  }

  if (!GLOBAL_INSTANCE.has(vid)) {
    GLOBAL_INSTANCE.set(vid, createGlobalInstance(instanceType))
  }

  const instance: Instance = {
    __IS_FISSION__: true,
    vid,
    uid: _uid,
    type: options,
    instanceType,
    parent: null,
    appContext: null,
    root: null, // to be immediately set
    effect: null,
    scope: new EffectScope(true /* detached */),
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: null,
    accessCache: null,
    props_update_promise: null,

    onLoadQuery,

    // local resolved assets
    components: null,

    // resolved props and emits options
    propsOptions: propsOptions,
    emitsOptions: emitsOptions,

    // emit
    emit: null, // to be set immediately
    emitted: null,
    createSelectorQuery: null,
    createIntersectionObserver: null,

    // props default value
    propsDefaults: EMPTY_OBJ,

    // inheritAttrs
    inheritAttrs: false,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    slotsScope: {},
    refs: {},
    setupState: EMPTY_OBJ,
    setupContext: null,
    _helpRefs: {},

    currentRenderPendingBranch: null,
    renderLoadingBranch: null,

    // suspense related
    asyncDep: null,
    asyncResolved: false,

    getCurrentPage: () => {
      if (instanceType === InstanceType.APP) return getCurrentPage()
      return GLOBAL_INSTANCE.get(pageId)?.instance
    },
    getPageId: () => {
      return pageId
    },

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    componentsLifecycle: {},
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null,
  }

  instance.ctx = { _: instance }
  instance.emit = emit || (() => {})
  instance.createSelectorQuery = createSelectorQuery
  instance.createIntersectionObserver = createIntersectionObserver

  if (instanceType === InstanceType.APP) {
    nativeInstance.$getGlobalRef = function (name) {
      return getCurrentPage()?.refs[name]
    }
  }

  const loadCallback = () => {
    if (instanceType === InstanceType.COMPONENT) {
      instance.props = initProps(
        propsOptions[0],
        rawProps,
        instance.type.useConfig
      )
    }
    let parent = null
    if (instance.props.fissionParentId) {
      const parentGlobalInstance = GLOBAL_INSTANCE.get(
        instance.props.fissionParentId as string
      )

      parent = parentGlobalInstance.instance
    }
    const root = GLOBAL_INSTANCE.get('app')
    parent = parent ?? root?.instance

    const _appContext =
      (parent ? parent.appContext : appContext) || createAppContext()

    instance.appContext = _appContext
    instance.parent = parent
    instance.provides = parent
      ? parent.provides
      : Object.create(_appContext.provides)

    instance.root = parent ? parent.root : instance

    nativeInstance[INSTANCE_VUE] = instance
    const currentGlobalInstance = GLOBAL_INSTANCE.get(vid)
    if (currentGlobalInstance) {
      currentGlobalInstance.instance = instance
    }
    initCallback(instance)
    if (currentGlobalInstance) {
      currentGlobalInstance.callbacks.forEach((fn) => fn())
    }
  }

  let isLoad = false
  if (instanceType === InstanceType.COMPONENT) {
    let parentGlobalInstance = GLOBAL_INSTANCE.get(pageId)
    if (!parentGlobalInstance) {
      GLOBAL_INSTANCE.set(
        pageId,
        (parentGlobalInstance = createGlobalInstance(InstanceType.PAGE))
      )
    }
    if (!parentGlobalInstance.instance) {
      isLoad = true
      parentGlobalInstance.callbacks.push(() => loadCallback())
    }
  }
  if (!isLoad) loadCallback()
}

export function getCurrentPageQuery(instance = currentInstance) {
  return instance.getCurrentPage()?.onLoadQuery
}

export function unloadInstance(nativeInstance: any) {
  const instance = getVueInstance(nativeInstance)
  if (instance) {
    const pageInstance = instance.getCurrentPage()
    if (pageInstance) {
      for (const k in pageInstance.componentsLifecycle) {
        const m = pageInstance.componentsLifecycle[k]
        if (m) {
          m.delete(instance.vid)
        }
      }
    }
    instance.scope.stop()
    instance.isUnmounted = true
    GLOBAL_INSTANCE.delete(instance.vid)
  }
}

export function getExposeProxy(instance: Instance) {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
          if (key in target) {
            return target[key]
          }
        },
        has(target, key: string) {
          return key in target
        },
      }))
    )
  }
}

export function createSetupContext(instance: Instance): SetupContext {
  const expose: SetupContext['expose'] = (exposed) => {
    if (__DEV__) {
      if (instance.exposed) {
        warn(`expose() should be called only once per setup().`)
      }
      if (exposed != null) {
        let exposedType: string = typeof exposed
        if (exposedType === 'object') {
          if (isArray(exposed)) {
            exposedType = 'array'
          } else if (isRef(exposed)) {
            exposedType = 'ref'
          }
        }
        if (exposedType !== 'object') {
          warn(
            `expose() should be passed a plain object, received ${exposedType}.`
          )
        }
      }
    }
    instance.exposed = exposed || {}
  }

  if (__DEV__) {
    // We use getters in dev in case libs like test-utils overwrite instance
    // properties (overwrites should not be done in prod)
    return Object.freeze({
      get attrs() {
        return shallowReadonly(instance.attrs)
      },
      get slots() {
        return shallowReadonly(instance.slots)
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args)
      },
      expose,
    })
  } else {
    return {
      get attrs() {
        return shallowReadonly(instance.attrs)
      },
      slots: instance.slots,
      emit: instance.emit,
      expose,
    }
  }
}

export let currentInstance: Instance | null = null

export const getCurrentInstance: () => Instance | null = () => currentInstance

export const setCurrentInstance = (instance: Instance) => {
  currentInstance = instance
  instance.scope.on()
}

export const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off()
  currentInstance = null
}

export function setupStatefulComponent(instance: Instance, setup: Function) {
  // 0. create render proxy property access cache
  instance.accessCache = Object.create(null)
  // 1. create public instance / render proxy
  // also mark it raw so it's never observed
  instance.proxy = markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers))

  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)

    setCurrentInstance(instance)
    pauseTracking()
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      [__DEV__ ? shallowReadonly(instance.props) : instance.props, setupContext]
    )
    resetTracking()
    unsetCurrentInstance()
    if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult)
    }
  }
}

export function clearRenderPendingBranch(
  nativeInstance: any
): RenderPendingBranch {
  const instance = getVueInstance(nativeInstance)
  const currentRenderPendingBranch = instance.currentRenderPendingBranch
  instance.currentRenderPendingBranch = null
  return currentRenderPendingBranch
}

export function isComponentType(instance: Instance | null = currentInstance) {
  return !!(instance && instance.instanceType === InstanceType.COMPONENT)
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, '')

export function getComponentName(
  Component: any,
  includeInferred = true
): string | false | undefined {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

/* istanbul ignore next */
export function formatComponentName(
  instance: Instance | null,
  Component: any,
  isRoot = false
): string {
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}
