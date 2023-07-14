import { getType, isArray } from './utils'

export const SKIP = '__SKEP__DIFF_SET_DATA__'

export const isSkip = (data: object | string): data is string => data === SKIP

function patch(
  newVal: any,
  oldVal: any,
  path: string,
  res: object
): boolean | void {
  if (getType(newVal) !== getType(oldVal)) {
    res[path] = newVal
    return true
  }
  const type = typeof newVal
  if (type === 'object') {
    if (isArray(newVal)) {
      if (newVal.length < oldVal.length || oldVal.length === 0) {
        if (newVal.length !== oldVal.length) {
          res[path] = newVal
          return true
        }
      } else {
        let f = 0
        const arrRes = {}
        for (let i = 0; i < newVal.length; i++) {
          if (patch(newVal[i], oldVal[i], `${path}[${i}]`, arrRes)) {
            f++
          }
          if (f > newVal.length * 0.35) {
            res[path] = newVal
            return true
          }
        }
        if (f > 0) {
          Object.assign(res, arrRes)
          return true
        }
      }
    } else {
      for (const k in oldVal) {
        if (!(k in newVal)) {
          res[path] = newVal
          return true
        }
      }
      let flag
      for (const k in newVal) {
        if (patch(newVal[k], oldVal[k], `${path}.${k}`, res)) {
          flag = true
        }
      }
      return flag
    }
  } else if (newVal !== oldVal) {
    res[path] = newVal
    return true
  }
  return false
}

export function diff(newData: object, oldData: object): object | string {
  const res = {}
  let flag = false
  for (const k in newData) {
    if (patch(newData[k], oldData[k], k, res)) {
      flag = true
    }
  }
  return flag ? res : SKIP
}
