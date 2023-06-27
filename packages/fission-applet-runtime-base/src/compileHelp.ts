import type { Instance } from './instance'
import { pauseTracking, resetTracking } from '@vue/reactivity'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import {
  getVueInstance,
  getExposeProxy,
  setCurrentInstance,
  unsetCurrentInstance,
} from './instance'
import {
  hasOwn,
  isPlainObject,
  isFunction,
  isArray,
  isString,
  isObject,
} from './utils'
import { COMPOSITION_EMIT_EVENT } from './emits'
import { warn } from './warning'
import { watchEffect } from './watch'

export function setupCallCompileHelp(instance: Instance) {
  const setupState = instance.setupState

  let setupAfter
  if (
    (setupAfter = instance.type?.__setupAfter) &&
    typeof setupAfter === 'function'
  ) {
    const res = setupAfter(instance.proxy)
    if (res) {
      wrapEventFn(res)
      for (const k in res) {
        setupState[k] = res[k]
      }
    }
  }
  setAfterRender(instance)

  initRefOwner(instance)
  setRef(instance)
}

function wrapEventFn(res: any) {
  if (!res) return res
  for (const k in res) {
    const fn = res[k]
    if (typeof fn === 'function') {
      res[k] = function (...args: any[]) {
        const e = args[0]
        let dataset
        let fissionArgs
        let wrap
        if (
          (typeof e === 'object' &&
            e.detail &&
            e.detail[COMPOSITION_EMIT_EVENT] &&
            (wrap = e.detail)) ||
          (typeof e === 'object' && e[COMPOSITION_EMIT_EVENT] && (wrap = e))
        ) {
          if (wrap.compileArgs && wrap.compileArgs.length > 0) {
            fn.call(this, wrap.args, ...wrap.compileArgs)
          } else {
            fn.apply(this, args)
          }
        } else if (
          typeof e === 'object' &&
          e.currentTarget &&
          (dataset = e.currentTarget.dataset) &&
          hasOwn(dataset, `fission_arg`) &&
          (fissionArgs = parseArg(dataset, k))
        ) {
          fn.call(this, [e], ...fissionArgs)
        } else {
          fn.apply(this, args)
        }
      }
    }
  }
}

function parseArg(dataset: any, name: string): any[] {
  const res = dataset['fission_arg'].find(([n]) => n === name)
  if (res && res[1]) return res[1]
}

export const defaultProps = [
  'fissionScopeId',
  'fissionEventScopeId',
  'fissionUseSlot',
  'fissionPageRef',
]

export function getCompileArgs(nativeInstance: any, name: string) {
  const instance = getVueInstance(nativeInstance)
  const fissionEventScopeId = instance.props['fissionEventScopeId']
  if (isArray(fissionEventScopeId) && fissionEventScopeId.length) {
    const res = fissionEventScopeId.find(([n]) => n === name)
    if (res && res[1]) {
      return res[1]
    }
  }
}

const GLOBAL_REF_PAGE_MAP = {}

export function getGlobalPageRef(pId, name: string) {
  return GLOBAL_REF_PAGE_MAP[pId]?.[name]
}

function parseFissionScopeId(fissionScopeId: string) {
  if (fissionScopeId && fissionScopeId.startsWith('for_')) {
    const [id, index] = fissionScopeId.split('-')
    return {
      id,
      index: Number(index),
      isFor: true,
    }
  }
  return {
    id: fissionScopeId,
  }
}

export function initScopeIdPageMapValue(id: string) {
  if (!id) return
  if (!GLOBAL_REF_PAGE_MAP[id]) {
    return (GLOBAL_REF_PAGE_MAP[id] = {})
  }
  return GLOBAL_REF_PAGE_MAP[id]
}

export function clearRefIdValue(instance: Instance) {
  if (!instance) return
  setRef(instance, true)
}

// function arrangeMax(value: any[]) {
//   let max = -1
//   for (let i = 0; i < value.length; i++) {
//     if (value[i] !== null) {
//       max = i
//     }
//   }
//   value.length = max > -1 ? max + 1 : 0
// }

export function setRef(instance: Instance, isUnmount = false) {
  if (isString(instance.props?.fissionScopeId)) {
    const refValue = getExposeProxy(instance)
    const value = isUnmount ? null : refValue
    // 如果是全局，直接加进page的ref里
    if (isString(instance.props?.fissionPageRef)) {
      const page = instance.getCurrentPage()
      if (page) {
        page.refs[instance.props?.fissionPageRef] = value
      }
      return
    }
    const { id } = parseFissionScopeId(instance.props.fissionScopeId)
    const parent = instance.parent
    if (parent) {
      const pOwner = parent?._helpRefs[id]
      if (isPlainObject(pOwner)) {
        const { key, isFunc } = pOwner
        if (isFunc) {
          if (hasOwn(parent.setupState, key)) {
            const refFn = parent.setupState[key]
            if (isFunction(refFn)) {
              refFn(value)
            }
          }
        } else {
          parent.refs[key] = value
          if (hasOwn(parent.setupState, key)) {
            parent.setupState[key] = value
          }
        }
      }
    }
  }
}

export function initRefOwner(instance: Instance) {
  if (!instance || !instance.setupState || !instance.type?.__refIdMapping) {
    return
  }
  const refIdMapping = instance.type?.__refIdMapping
  for (const fissionScopeId in refIdMapping) {
    const { id } = parseFissionScopeId(fissionScopeId)
    const key = refIdMapping[fissionScopeId]
    instance._helpRefs[id] = {
      key,
      isFunc: isFunction(instance.setupState[key]),
    }
  }
}

/**
 * 组件在初始化后，设置作用域插槽数据
 */
export function setSlotScope(instance: Instance, isUnmount = false) {
  if (
    isString(instance.props?.fissionScopeId) &&
    instance.type?.__slotsScopeMap
  ) {
    // const { id } = parseFissionScopeId(instance.props.fissionScopeId)
    const parent = instance.parent
    if (parent) {
      // parent.slotsScope[id]
    }
  }
}

export function setParentScopeSlot(
  slotsScope: Record<string, any>,
  name: string,
  id: string,
  props: Record<string, any>
) {
  console.log(name, id, props)
  ;(slotsScope[name] || (slotsScope[name] = [])).push({
    id,
    props,
  })
}

export function setAfterRender(instance: Instance) {
  let initAfterRender
  if (
    (initAfterRender = instance.type?.__initAfterRender) &&
    typeof initAfterRender === 'function' &&
    isString(instance.props?.fissionScopeId)
  ) {
    const { id } = parseFissionScopeId(instance.props.fissionScopeId)
    const slotsScopeAll = instance.parent?.slotsScope || {}
    const slotsScope = (slotsScopeAll[id] = {})
    setCurrentInstance(instance)
    pauseTracking()
    callWithErrorHandling(initAfterRender, instance, ErrorCodes.AFTER_RENDER, [
      instance.proxy,
      {
        $each,
        watchEffect,
        setParentScopeSlot: (name, id, props) =>
          setParentScopeSlot(slotsScope, name, id, props),
        clearParentScopeSlot(names: string[]) {
          for (let i = 0; i < names.length; i++) {
            slotsScope[names[i]] = []
          }
        },
      },
    ])
    resetTracking()
    unsetCurrentInstance()
  }
}

function $each(source, renderItem) {
  let ret
  if (isArray(source) || isString(source)) {
    ret = new Array(source.length)
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(source[i], i, i)
    }
  } else if (typeof source === 'number') {
    if (!Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
      return []
    }
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i, i)
    }
  } else if (isObject(source)) {
    // @ts-ignore
    if (source[Symbol.iterator]) {
      // @ts-ignore
      ret = Array.from(source, (item, i) => renderItem(item, i, i))
    } else {
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i)
      }
    }
  } else {
    ret = []
  }
  return ret
}
