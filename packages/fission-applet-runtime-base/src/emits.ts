import {
  UnionToIntersection,
  isArray,
  extend,
  isFunction,
  toHandlerKey,
  camelize,
  hasOwn,
} from './utils'
import { warn } from './warning'
import { NormalizedProps } from './props'
import { aop, setupPrivateAOP } from './aop'
import { getVueInstance, Instance } from './instance'
export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>

export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options
> = Options extends Array<infer V>
  ? (event: V, ...args: any[]) => void
  : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
  ? (event: string, ...args: any[]) => void
  : UnionToIntersection<
      {
        [key in Event]: Options[key] extends (...args: infer Args) => any
          ? (event: key, ...args: Args) => void
          : (event: key, ...args: any[]) => void
      }[Event]
    >

export function normalizeEmitsOptions(
  raw: EmitsOptions
): ObjectEmitsOptions | null {
  if (!raw) {
    return null
  }
  const normalized: ObjectEmitsOptions = {}

  if (isArray(raw)) {
    raw.forEach((key) => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  return normalized
}

export function validateEmit(
  emitsOptions: ObjectEmitsOptions,
  propsOptions: NormalizedProps,
  event: string,
  ...rawArgs: any[]
) {
  if (emitsOptions) {
    if (!(event in emitsOptions)) {
      if (!propsOptions || !(toHandlerKey(event) in propsOptions)) {
        warn(
          `Component emitted event "${event}" but it is neither declared in ` +
            `the emits option nor as an "${toHandlerKey(event)}" prop.`
        )
      }
    } else {
      const validator = emitsOptions[event]
      if (isFunction(validator)) {
        const isValid = validator(...rawArgs)
        if (!isValid) {
          warn(
            `Invalid event arguments: event validation failed for event "${event}".`
          )
        }
      }
    }
  }
}

export const COMPOSITION_EMIT_EVENT = '$__COMPOSITION_EMIT_EVENT__$'

export function wrapEmitDetail(args: unknown[], other: unknown[]) {
  return {
    [COMPOSITION_EMIT_EVENT]: true,
    args,
    compileArgs: other,
  }
}

let currentApp = null
export function useApp() {
  return currentApp || getApp()
}

let currentPage = null
export function getCurrentPage(isNative = false): Instance {
  return isNative ? currentPage : getVueInstance(currentPage)
}

export function initEmitWrap() {
  setupPrivateAOP(({ page, component, app }) => {
    app.add(
      aop({
        onLaunch() {
          currentApp = this
        },
      })
    )
    component.add(
      aop({
        methods: aop(wrapEventHandle),
      })
    )
    page.add(
      aop(
        {
          onLoad: null,
          onUnload: null,
          onShow() {
            currentPage = this
          },
          onHide: null,
          onReady: null,
          onTitleClick: null,
          onPullDownRefresh: null,
          onReachBottom: null,
          onTabItemTap: null,
          onShareAppMessage: null,
          onShareTimeline: null,
          onAddToFavorites: null,
          onPageScroll: null,
          onSaveExitState: null,
          onResize: null,
        },
        wrapEventHandle
      )
    )
  })
}

const datasetKey = 'fission_data_keys'

export function wrapEventHandle(args: any[]) {
  if (!args) return
  const e = args[0]
  let wrap

  if (
    (typeof e === 'object' &&
      e.detail &&
      e.detail[COMPOSITION_EMIT_EVENT] &&
      (wrap = e.detail)) ||
    (typeof e === 'object' && e[COMPOSITION_EMIT_EVENT] && (wrap = e))
  ) {
    if (args.splice && !wrap.compileArgs) {
      args.splice(0, args.length, ...wrap.args)
    }
  }
  if (typeof e === 'object') {
    if (e.target && e.target.dataset && e.target.dataset[datasetKey]) {
      e.target.dataset = normalizeDataset(e.target.dataset, false)
    }
    if (
      e.currentTarget &&
      e.currentTarget.dataset &&
      e.currentTarget.dataset[datasetKey]
    ) {
      e.currentTarget.dataset = normalizeDataset(e.currentTarget.dataset, false)
    }
  }
}

export function normalizeDataset(dataset: Record<string, any>, retain = true) {
  const res = Object.assign({}, dataset)
  if (dataset[datasetKey]) {
    dataset[datasetKey].split(',').forEach((v: string) => {
      const camelizeKey = camelize(v)
      const lowercaseKey = camelizeKey.toLowerCase()
      if (hasOwn(res, lowercaseKey)) {
        const val = res[lowercaseKey]
        if (!hasOwn(res, camelizeKey)) {
          res[camelizeKey] = val
          if (!retain) {
            delete res[lowercaseKey]
          }
        }
      }
    })
    if (!retain) {
      delete res[datasetKey]
    }
  }
  return res
}
