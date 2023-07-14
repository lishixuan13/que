import {
  PluginBuild as EsbuildPluginBuild,
  ResolveOptions as EsbuildResolveOptions,
  ResolveResult,
  OnLoadResult,
  OnLoadArgs,
} from 'esbuild'

export interface ResolveOptions extends EsbuildResolveOptions {
  //   skipPlugin: '$selfResolve' | '$selfPlugin' | string
  skipSelf: boolean
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-options */
export interface OnTransformOptions {
  filter: RegExp
  namespace?: string
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-arguments */
export type OnTransformArgs = OnLoadResult

/** Documentation: https://esbuild.github.io/plugins/#on-load-results */
export type OnTransformResult = OnLoadResult

export interface PluginBuild
  extends Pick<
    EsbuildPluginBuild,
    | 'initialOptions'
    | 'onStart'
    | 'onEnd'
    | 'onResolve'
    | 'onLoad'
    | 'onDispose'
    | 'esbuild'
  > {
  /** Documentation: https://esbuild.github.io/plugins/#resolve */
  resolve(path: string, options?: ResolveOptions): Promise<ResolveResult>
  onTransform(
    options: OnTransformOptions,
    callback: (
      args: OnTransformArgs,
      onLoadArgs: OnLoadArgs
    ) =>
      | OnTransformResult
      | null
      | undefined
      | Promise<OnTransformResult | null | undefined>
  ): void
}

export interface Plugin {
  name: string
  setup: (build: PluginBuild) => void | Promise<void>
}

export interface OnTransformOptions {
  filter: RegExp
  namespace?: string
}
