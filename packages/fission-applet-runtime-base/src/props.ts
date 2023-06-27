import { toRaw, shallowReactive, reactive } from '@vue/reactivity'
import {
  hasOwn,
  hyphenate,
  isArray,
  makeMap,
  isObject,
  capitalize,
  getType as toRawType,
  isString,
  isFunction,
  EMPTY_OBJ,
  camelize,
  isSimpleValue,
} from './utils'
import { warn } from './warning'
import { defaultProps } from './compileHelp'
export type Data = Record<string, unknown>

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown): boolean
}

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type PropConstructor<T = any> =
  | { new (...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
] // if is function with args, allowing non-required functions
  ? { new (): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

type AssertionResult = {
  valid: boolean
  expectedType: string
}

const enum BooleanFlags {
  shouldCast,
  shouldCastTrue,
}

type NormalizedProp =
  | null
  | (PropOptions & {
      [BooleanFlags.shouldCast]?: boolean
      [BooleanFlags.shouldCastTrue]?: boolean
    })

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

export function normalizePropsOptions(
  raw: ComponentPropsOptions
): NormalizedPropsOptions {
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  // 编译相关默认props
  defaultProps.forEach((key) => {
    normalized[key] = EMPTY_OBJ
  })

  if (!raw) {
    return [normalized, needCastKeys] as any
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt)
        if (!isSimpleValue(prop)) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] =
            stringIndex < 0 || booleanIndex < stringIndex
          // if the prop needs boolean casting or default value
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  return res
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true
): number {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex((t) => isSameType(t, type))
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}

function validatePropName(key: string) {
  if (key[0] !== '$') {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ctor === null ? 'null' : ''
}

const isSimpleType = /*#__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol,BigInt'
)

/**
 * dev only
 */
function assertType(value: unknown, type: PropConstructor): AssertionResult {
  let valid
  const expectedType = getType(type)
  if (isSimpleType(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else if (expectedType === 'null') {
    valid = value === null
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType,
  }
}

/**
 * dev only
 */
function getInvalidTypeMessage(
  name: string,
  value: unknown,
  expectedTypes: string[]
): string {
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(' | ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

/**
 * dev only
 */
export function validateProps(
  rawProps: Data,
  props: Data,
  options: NormalizedProps
) {
  const resolvedValues = toRaw(props)

  for (const key in options) {
    const opt = options[key]
    if (opt == null) continue
    validateProp(
      key,
      resolvedValues[key],
      opt,
      !hasOwn(rawProps, key) && !hasOwn(rawProps, hyphenate(key))
    )
  }
}

/**
 * dev only
 */
function validateProp(
  name: string,
  value: unknown,
  prop: PropOptions,
  isAbsent: boolean
) {
  const { type, required, validator } = prop
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !prop.required) {
    return
  }
  // type check
  if (type != null && type !== true) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }
  // custom validator
  if (validator && !validator(value)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}

/**
 * dev only
 */
function styleValue(value: unknown, type: string): string {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

/**
 * dev only
 */
function isExplicable(type: string): boolean {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some((elem) => type.toLowerCase() === elem)
}

/**
 * dev only
 */
function isBoolean(...args: string[]): boolean {
  return args.some((elem) => elem.toLowerCase() === 'boolean')
}

/**
 * 初始化props
 * @param param0
 * @param props props对象
 * @returns
 */
export function initProps(
  normalizedProps: NormalizedProps,
  props: Data = {},
  useConfig: Data
) {
  const rawProps: Record<string, any> = {}
  if (normalizedProps && props) {
    for (const key in normalizedProps) {
      if (hasOwn(props, key)) {
        const val = props[key]
        rawProps[key] =
          isObject(val) &&
          useConfig &&
          isArray(useConfig.deepChangeProps) &&
          useConfig.deepChangeProps.includes(key)
            ? reactive(val)
            : shouldDefault(val)
            ? getDefaultValue(normalizedProps[key])
            : val
      }
    }
    if (__DEV__) {
      validateProps(props, rawProps, normalizedProps)
    }
  }

  return shallowReactive(rawProps)
}

export function shouldDefault(value: unknown) {
  return value === void 0
}

export function getDefaultValue(prop: PropOptions) {
  if (!isObject(prop)) {
    return prop
  }
  if (!Array.isArray(prop.type)) {
    if (prop.type === Object || prop.type === Array) {
      if (typeof prop.default === 'function') {
        return prop.default()
      }
    }
  }
  return prop.default
}

export function setPropsValue(
  newVal: any,
  target: any,
  key: string | number,
  deepChangeProps?: string[],
  isRoot = true
) {
  if (isRoot && !(deepChangeProps && deepChangeProps.includes(key as string))) {
    target[key] = newVal
    return
  }
  const oldVal = target[key]
  if (toRawType(newVal) !== toRawType(oldVal)) {
    target[key] = isRoot && isObject(newVal) ? reactive(newVal) : newVal
    return true
  }
  const type = typeof newVal
  if (type === 'object') {
    if (isArray(newVal)) {
      let flag = false
      let end = oldVal.length
      if (oldVal.length < newVal.length) {
        flag = true
        oldVal.push(...newVal.slice(oldVal.length))
        end = oldVal.length
      } else if (oldVal.length > newVal.length) {
        flag = true
        end = oldVal.length = newVal.length
      }

      for (let i = 0; i < end; i++) {
        if (setPropsValue(newVal[i], oldVal, i, null, false)) {
          flag = true
        }
      }
      return flag
    } else {
      let flag = false
      for (const k in oldVal) {
        if (!(k in newVal)) {
          delete oldVal[k]
          flag = true
        }
      }
      for (const k in newVal) {
        if (setPropsValue(newVal[k], oldVal, k, null, false)) {
          flag = true
        }
      }
      return flag
    }
  } else if (newVal !== oldVal) {
    target[key] = isRoot && isObject(newVal) ? reactive(newVal) : newVal
    return true
  }
  return false
}

// const WARPLISTFLAG = 'FISSION_WARP_LIST_FLAG'

// function isWrapList() {}
