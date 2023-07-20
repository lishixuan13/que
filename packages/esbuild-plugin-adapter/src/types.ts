import {
  PluginBuild as EsbuildPluginBuild,
  ResolveOptions as EsbuildResolveOptions,
  ResolveResult,
  OnLoadResult as EsbuildOnLoadResult,
  OnLoadArgs,
  OnLoadOptions,
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
export type OnTransformArgs = EsbuildOnLoadResult

export interface OnTransformLoadArgs extends OnLoadArgs {
  virtualPath?: string
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-results */
export type OnTransformResult = EsbuildOnLoadResult

export interface OnLoadResult extends EsbuildOnLoadResult {
  virtualPath?: string
}

export interface PluginBuild
  extends Pick<
    EsbuildPluginBuild,
    | 'initialOptions'
    | 'onStart'
    | 'onEnd'
    | 'onResolve'
    | 'onDispose'
    | 'esbuild'
  > {
  /** Documentation: https://esbuild.github.io/plugins/#resolve */
  resolve(path: string, options?: ResolveOptions): Promise<ResolveResult>
  onLoad(
    options: OnLoadOptions,
    callback: (
      args: OnLoadArgs
    ) =>
      | OnLoadResult
      | null
      | undefined
      | Promise<OnLoadResult | null | undefined>
  ): void
  onTransform(
    options: OnTransformOptions,
    callback: (
      args: OnTransformArgs,
      onLoadArgs: OnTransformLoadArgs
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
