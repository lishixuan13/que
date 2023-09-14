import { Plugin } from '../plugin'
import { ResolvedConfig } from '../config'
import alias from './alias'
import css from './css'

export function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Plugin[] {
  return [
    // config.performance ? performancePlugin(config) : null,
    alias(config.resolve.alias),
    // tryOutplatform(config.outPlatform),
    // preprocessPlugin(config),
    ...prePlugins,
    css(config),
    ...normalPlugins,
    ...postPlugins,
  ].filter(Boolean)
}

export function getSortedPluginsByHook(
  hookName: keyof Plugin,
  plugins: readonly Plugin[]
): Plugin[] {
  const pre: Plugin[] = []
  const normal: Plugin[] = []
  const post: Plugin[] = []
  for (const plugin of plugins) {
    const hook = plugin[hookName]
    if (hook) {
      if (typeof hook === 'object') {
        if (hook.order === 'pre') {
          pre.push(plugin)
          continue
        }
        if (hook.order === 'post') {
          post.push(plugin)
          continue
        }
      }
      normal.push(plugin)
    }
  }
  return [...pre, ...normal, ...post]
}
