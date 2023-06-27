import { getCurrentInstance } from './instance'
import { EMPTY_OBJ } from './utils'
import { warn } from './warning'

/**
 * 不支持的 vue api
 */

export const defineComponent = <T>(options: T): T => options

const createMsg = (name: string) =>
  `${name} API is not supported on applet side`

export const defineAsyncComponent = <T>(options: T): T => {
  if (__DEV__) {
    console.warn(createMsg('defineAsyncComponent'))
  }
  return options
}

export const defineCustomElement = <T>(options: T): T => {
  if (__DEV__) {
    console.warn(createMsg('defineCustomElement'))
  }
  return options
}

export function useCssModule(name = '$style'): Record<string, string> {
  /* istanbul ignore else */
  const instance = getCurrentInstance()
  if (!instance) {
    __DEV__ && warn(`useCssModule must be called inside setup()`)
    return EMPTY_OBJ
  }
  const modules = instance.type.__cssModules
  if (!modules) {
    __DEV__ && warn(`Current instance does not have CSS modules injected.`)
    return EMPTY_OBJ
  }
  const mod = modules[name]
  if (!mod) {
    __DEV__ &&
      warn(`Current instance does not have CSS module named "${name}".`)
    return EMPTY_OBJ
  }
  return mod as Record<string, string>
}

export const version = ''
