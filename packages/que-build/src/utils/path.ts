import { createStringHash } from './crypto'
import os from 'node:os'
// import { U_NAME } from '../constants'
import { parse, join, basename, relative, extname, dirname, posix } from 'path'
const ABSOLUTE_PATH_REGEX = /^(?:\/|(?:[A-Za-z]:)?[\\|/])/
const RELATIVE_PATH_REGEX = /^\.?\.(\/|$)/

export function isAbsolute(path: string): boolean {
  return ABSOLUTE_PATH_REGEX.test(path)
}

export function isRelative(path: string): boolean {
  return RELATIVE_PATH_REGEX.test(path)
}

export function getFileBase(id: string) {
  const result = parse(id)
  return join(result.dir, result.name)
}

export function removeExt(id: string) {
  return id.split('?')[0]
}

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}
export const isWindows = os.platform() === 'win32'

export function normalizePath(id: string): string {
  return posix.normalize(isWindows ? slash(id) : id)
}

export const replaceUrlRE = /__FISSION_PATH__([a-z\d]{8})__/g

export function createPathId(s: string) {
  const hash = createStringHash(s)
  return `__FISSION_PATH__${hash}__`
}

export function getAliasName(id: string): string {
  const base = basename(id)
  return base.substring(0, base.length - extname(id).length)
}

export function isPathFragment(name: string): boolean {
  // starting with "/", "./", "../", "C:/"
  return (
    name[0] === '/' ||
    (name[0] === '.' && (name[1] === '/' || name[1] === '.')) ||
    isAbsolute(name)
  )
}

const UPPER_DIR_REGEX = /^(\.\.\/)*\.\.$/

export function removeStartPath(p: string, base: string) {
  const np = normalize(p)
  const nb = normalize(base)
  const index = np.indexOf(nb)
  if (index === 0) {
    return np.substring(index + nb.length)
  }
  return false
}

export function getImportPath(
  importerId: string,
  targetPath: string,
  stripJsExtension: boolean,
  ensureFileName: boolean
): string {
  let relativePath = normalize(relative(dirname(importerId), targetPath))
  if (stripJsExtension && relativePath.endsWith('.js')) {
    relativePath = relativePath.slice(0, -3)
  }
  if (ensureFileName) {
    if (relativePath === '') return '../' + basename(targetPath)
    if (UPPER_DIR_REGEX.test(relativePath)) {
      return relativePath
        .split('/')
        .concat(['..', basename(targetPath)])
        .join('/')
    }
  }
  return !relativePath
    ? '.'
    : relativePath.startsWith('..')
    ? relativePath
    : './' + relativePath
}

export { parse, join, basename, relative, extname, dirname }

export { resolve } from 'path'
