// Public API ------------------------------------------------------------------
export {
  // Core
  computed,
  reactive,
  ref,
  readonly,
  // Utilities
  unref,
  proxyRefs,
  isRef,
  toRef,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  // Advanced
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  // Effect
  effect,
  stop,
  ReactiveEffect,
  // Effect scope
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
} from '@vue/reactivity'
export {
  setCurrentInstance,
  unsetCurrentInstance,
  getCurrentInstance,
  createInstance,
  setupStatefulComponent,
  getVueInstance,
  isComponentType,
  getCurrentPageQuery,
} from './instance'
export { createApp as createAppApi } from './apiCreateApp'
export {
  createAppHook,
  createPageHook,
  createComponentHook,
  createOneConfigHook,
  createConfigHook,
  createtHook,
  callHook,
} from './lifecycle'
export {
  resolveOptions,
  resolveLifecycle,
  markComposition,
  isComposition,
  setGlobalConfig,
} from './resolve'
export { watch, watchEffect, watchPostEffect, watchSyncEffect } from './watch'
export { nextTick, queueJob } from './scheduler'
export { provide, inject } from './inject'
export { deepToRaw, deepWatch } from './shared'
export { mount, unmount, nextTickInstance, useNextTick } from './renderer'
export {
  normalizePropsOptions,
  validateProps,
  initProps,
  getDefaultValue,
  shouldDefault,
  setPropsValue,
} from './props'
export {
  normalizeEmitsOptions,
  validateEmit,
  wrapEmitDetail,
  initEmitWrap,
  useApp,
  getCurrentPage,
  normalizeDataset,
} from './emits'
export {
  aop,
  aopObject,
  setupAOP,
  setupPrivateAOP,
  callAOP,
  callSetupAfterAOP,
} from './aop'
export {
  getType,
  isFunction,
  isArray,
  isSimpleValue,
  isObject,
  isPlainObject,
  isUndef,
  isMap,
  isSet,
  hasChanged,
  remove,
  toHiddenShouldField,
  NOOP,
  hasOwn,
  toHandlerKey,
  camelize,
} from './utils'
export { getCompileArgs, setupCallCompileHelp } from './compileHelp'
export {
  defineComponent,
  defineAsyncComponent,
  defineCustomElement,
  useCssModule,
} from './unsupported'
export { LifecycleHooks } from './enums'
// Types -----------------------------------------------------------------------

export {
  Ref,
  ToRef,
  ToRefs,
  ReactiveEffectOptions,
  DebuggerEvent,
  DebuggerOptions,
  TrackOpTypes,
  TriggerOpTypes,
  ComputedRef,
  WritableComputedRef,
  UnwrapRef,
  ShallowUnwrapRef,
  WritableComputedOptions,
  DeepReadonly,
} from '@vue/reactivity'
export {
  WatchEffect,
  WatchOptions,
  WatchOptionsBase,
  WatchCallback,
  WatchSource,
  WatchStopHandle,
} from './watch'
export { InjectionKey } from './inject'
export { Instance, Data } from './instance'
export { InstanceType } from './enums'
export { FactoryOptions, Options, Query, GlobalConfig } from './resolve'
export {
  ComponentPropsOptions,
  ComponentObjectPropsOptions,
  Prop,
  PropOptions,
  PropType,
  NormalizedProps,
  NormalizedPropsOptions,
} from './props'

export { EmitsOptions, ObjectEmitsOptions, EmitFn } from './emits'
export { AopOptions, AopWrap, AopOpt, AOPHideOpt, SetupAop } from './aop'
