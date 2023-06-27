export const { isArray } = Array

export const extend = Object.assign

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

const camelizeRE = /-(\w)/g
/**
 * @private
 */
export const camelize = cacheStringFunction((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

/**
 * @private
 */
export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
)

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}

export const EMPTY_ARR = __DEV__ ? Object.freeze([]) : []

export function getType(x: unknown): string {
  return Object.prototype.toString.call(x).slice(8, -1)
}

export function isUndef(v): v is void {
  return v === undefined || v === null
}

export function isSimpleValue(x: unknown): boolean {
  const simpleTypes = new Set(['undefined', 'boolean', 'number', 'string'])
  return x === null || simpleTypes.has(typeof x)
}

export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return getType(x) === 'Object'
}

export function isFunction(x: unknown): x is Function {
  return typeof x === 'function'
}

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return (
    isObject(val) &&
    isFunction((val as any).then) &&
    isFunction((val as any).catch)
  )
}

export const isString = (val: unknown): val is string => typeof val === 'string'

export function isMap(x: unknown): x is Map<any, any> {
  return getType(x) === 'Map'
}

export function isSet(x: unknown): x is Set<any> {
  return getType(x) === 'Set'
}

// Compare whether a value has changed, accounting for NaN.
export function hasChanged(value: unknown, oldValue: unknown): boolean {
  return !Object.is(value, oldValue)
}

export function hasDeepChanged(val: any, oldVal: any) {
  if (getType(val) !== getType(oldVal)) {
    return true
  }
  if (typeof val === 'object') {
    if (isArray(val)) {
      if (val.length < oldVal.length || oldVal.length === 0) {
        if (val.length !== oldVal.length) {
          return true
        }
      } else {
        let flag = false
        for (let i = 0; i < val.length; i++) {
          if (hasDeepChanged(val[i], oldVal[i])) {
            flag = true
          }
        }
        return flag
      }
    } else {
      for (const k in oldVal) {
        if (!(k in val)) {
          return true
        }
      }
      let flag = false
      for (const k in val) {
        if (hasDeepChanged(val[k], oldVal[k])) {
          flag = true
        }
      }
      return flag
    }
  } else if (!Object.is(val, oldVal)) {
    return true
  }
  return false
}

export function remove<T>(arr: T[], el: T): void {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}

export function toHiddenShouldField(name: string): string {
  return `$__is_${name}__$`
}

export const NOOP = () => {
  // NOOP
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => boolean {
  const map: Record<string, boolean> = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? (val) => !!map[val.toLowerCase()]
    : (val) => !!map[val]
}

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

/**
 * @private
 */
export const toHandlerKey = cacheStringFunction((str: string) =>
  str ? `on${capitalize(str)}` : ``
)

export function createRandomId() {
  return Date.now() + '' + Math.floor(Math.random() * 1e7)
}
