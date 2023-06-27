import { Data } from './instance'
import { ComponentCustomProperties, ComponentPublicInstance } from './context'
import { InjectionKey } from './inject'
import { warn } from './warning'
import { isFunction, isObject } from './utils'
import { NormalizedPropsOptions } from './props'
import { ObjectEmitsOptions } from './emits'

export interface App<HostElement = any> {
  version: string
  config: AppConfig

  use<Options extends unknown[]>(
    plugin: Plugin<Options>,
    ...options: Options
  ): this
  use<Options>(plugin: Plugin<Options>, options: Options): this

  mixin(mixin: any): this
  component(name: string): string | undefined
  component(name: string, component: string): this
  directive(name: string): any | undefined
  directive(name: string, directive: any): this
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean,
    isSVG?: boolean
  ): ComponentPublicInstance
  unmount(): void
  provide<T>(key: InjectionKey<T> | string, value: T): this

  // internal, but we need to expose these for the server-renderer and devtools
  _uid: number
  _component: any
  _props: Data | null
  _container: HostElement | null
  _context: AppContext
  _instance: any | null

  /**
   * v2 compat only
   */
  filter?(name: string): Function | undefined
  filter?(name: string, filter: Function): this
}

export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
  // @private
  readonly isNativeTag?: (tag: string) => boolean

  performance: boolean
  optionMergeStrategies: Record<string, OptionMergeFunction>
  globalProperties: ComponentCustomProperties & Record<string, any>
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string
  ) => void

  /**
   * Options to pass to `@vue/compiler-dom`.
   * Only supported in runtime compiler build.
   */
  compilerOptions: any

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   */
  isCustomElement?: (tag: string) => boolean

  /**
   * Temporary config for opt-in to unwrap injected refs.
   * TODO deprecate in 3.3
   */
  unwrapInjectedRef?: boolean
}

export interface AppContext {
  app: App // for devtools
  config: AppConfig
  mixins: any[]
  components: Record<string, string>
  directives: Record<string, any>
  provides: Record<string | symbol, any>

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   */
  optionsCache: WeakMap<any, any>
  /**
   * Cache for normalized props options
   * @internal
   */
  propsCache: WeakMap<any, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   */
  emitsCache: WeakMap<any, ObjectEmitsOptions | null>
  /**
   * HMR only
   * @internal
   */
  reload?: () => void
  /**
   * v2 compat only
   * @internal
   */
  filters?: Record<string, Function>
}

type PluginInstallFunction<Options> = Options extends unknown[]
  ? (app: App, ...options: Options) => any
  : (app: App, options: Options) => any

export type Plugin<Options = any[]> =
  | (PluginInstallFunction<Options> & {
      install?: PluginInstallFunction<Options>
    })
  | {
      install: PluginInstallFunction<Options>
    }

export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: () => false,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: string,
  rootProps?: Data | null
) => App<HostElement>

let uid = 0

export function createApp(rootComponent, rootProps = null) {
  if (rootProps != null && !isObject(rootProps)) {
    __DEV__ && warn(`root props passed to app.mount() must be an object.`)
    rootProps = null
  }

  const context = createAppContext()
  const installedPlugins = new Set()

  const isMounted = false

  const app: App = (context.app = {
    _uid: uid++,
    _component: rootComponent as any,
    _props: rootProps,
    _container: null,
    _context: context,
    _instance: null,

    version: '',

    get config() {
      return context.config
    },

    set config(v) {
      if (__DEV__) {
        warn(
          `app.config cannot be replaced. Modify individual options instead.`
        )
      }
    },

    use(plugin: Plugin, ...options: any[]) {
      if (installedPlugins.has(plugin)) {
        __DEV__ && warn(`Plugin has already been applied to target app.`)
      } else if (plugin && isFunction(plugin.install)) {
        installedPlugins.add(plugin)
        plugin.install(app, ...options)
      } else if (isFunction(plugin)) {
        installedPlugins.add(plugin)
        plugin(app, ...options)
      } else if (__DEV__) {
        warn(
          `A plugin must either be a function or an object with an "install" ` +
            `function.`
        )
      }
      return app
    },

    mixin() {
      if (__DEV__) {
        warn('Mixins are only available in builds supporting Options API')
      }
      return app
    },

    component(name: string, component?: string): any {
      if (!component) {
        return context.components[name]
      }
      if (__DEV__ && context.components[name]) {
        warn(`string "${name}" has already been registered in target app.`)
      }
      context.components[name] = component
      return app
    },

    directive() {
      return app
    },

    mount(): any {
      if (!isMounted) {
        // // store app context on the root VNode.
        // // this will be set on the root instance on initial mount.
        // vnode.appContext = context
        // return getExposeProxy(vnode.component!) || vnode.component!.proxy
      } else if (__DEV__) {
        warn(
          `App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``
        )
      }
    },

    unmount() {
      //
    },

    provide(key, value) {
      if (__DEV__ && (key as string | symbol) in context.provides) {
        warn(
          `App already provides property with key "${String(key)}". ` +
            `It will be overwritten with the new value.`
        )
      }

      context.provides[key as string | symbol] = value

      return app
    },
  })
  return app
}
