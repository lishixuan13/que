import { isRef, isProxy, toRaw } from '@vue/reactivity'
import { watch } from './watch'
import { mergeDataChange } from './renderer'
import {
  isArray,
  isSimpleValue,
  isPlainObject,
  isFunction,
  getType,
} from './utils'
import { getVueInstance } from './instance'

export function deepToRaw(x: unknown): unknown {
  if (isSimpleValue(x) || isFunction(x)) {
    return x
  }

  if (isRef(x)) {
    return deepToRaw(x.value)
  }

  if (isProxy(x)) {
    return deepToRaw(toRaw(x))
  }

  if (isArray(x)) {
    return x.map((item) => deepToRaw(item))
  }

  if (isPlainObject(x)) {
    const obj: Record<string, unknown> = {}
    Object.keys(x).forEach((key) => {
      obj[key] = deepToRaw(x[key])
    })
    return obj
  }

  throw new TypeError(`${getType(x)} value is not supported`)
}

export function deepWatch(nativeInstance: any, key: string): void {
  const instance = getVueInstance(nativeInstance)
  watch(
    () => instance.setupState[key],
    () => {
      mergeDataChange(key, nativeInstance)
    },
    {
      deep: true,
    }
  )
}
