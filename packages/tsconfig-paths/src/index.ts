import { loadConfig } from 'tsconfig-paths'
import path from 'node:path'

const match = createTsMatch('/Users/edy/Desktop/project/alipay_applet/apps/jzx')

console.log(match('src/mine'))

export function createTsMatch<T extends string | undefined>(
  dir: string,
  notFoundReturn?: T
): (source: string) => T {
  const configLoaderResult = loadConfig(dir)
  if (configLoaderResult.resultType === 'failed') {
    return (str: string) => notFoundReturn
  }
  const absolutePaths = getAbsoluteMappingEntries(
    configLoaderResult.absoluteBaseUrl,
    configLoaderResult.paths,
    configLoaderResult.addMatchAll
  )
  return (source: string) =>
    getPaths(absolutePaths, source, notFoundReturn) as any
}

export interface Paths {
  readonly [key: string]: ReadonlyArray<string>
}

export interface MappingEntry {
  readonly pattern: string
  readonly paths: ReadonlyArray<string>
}

export function getPaths(
  absolutePathMappings: ReadonlyArray<MappingEntry>,
  requestedModule: string,
  notFoundReturn: unknown
): string | undefined {
  if (!absolutePathMappings || !requestedModule || requestedModule[0] === '.') {
    return notFoundReturn as any
  }

  for (const entry of absolutePathMappings) {
    const starMatch =
      entry.pattern === requestedModule
        ? ''
        : matchStar(entry.pattern, requestedModule)
    if (starMatch !== undefined) {
      for (const physicalPathPattern of entry.paths) {
        const physicalPath = physicalPathPattern.replace('*', starMatch)
        return physicalPath
      }
    }
  }
  return notFoundReturn as any
}

/**
 * Matches pattern with a single star against search.
 * Star must match at least one character to be considered a match.
 */
function matchStar(pattern: string, search: string): string | undefined {
  if (search.length < pattern.length) {
    return undefined
  }
  if (pattern === '*') {
    return search
  }
  const star = pattern.indexOf('*')
  if (star === -1) {
    return undefined
  }
  const part1 = pattern.substring(0, star)
  const part2 = pattern.substring(star + 1)
  if (search.substring(0, star) !== part1) {
    return undefined
  }
  if (search.substring(search.length - part2.length) !== part2) {
    return undefined
  }
  return search.substring(star, search.length - part2.length)
}

/**
 * Converts an absolute baseUrl and paths to an array of absolute mapping entries.
 * The array is sorted by longest prefix.
 * Having an array with entries allows us to keep a sorting order rather than
 * sort by keys each time we use the mappings.
 */
export function getAbsoluteMappingEntries(
  absoluteBaseUrl: string,
  paths: Paths,
  addMatchAll: boolean
): ReadonlyArray<MappingEntry> {
  // Resolve all paths to absolute form once here, and sort them by
  // longest prefix once here, this saves time on each request later.
  // We need to put them in an array to preserve the sorting order.
  const sortedKeys = sortByLongestPrefix(Object.keys(paths))
  const absolutePaths: Array<MappingEntry> = []
  for (const key of sortedKeys) {
    absolutePaths.push({
      pattern: key,
      paths: paths[key].map((pathToResolve) =>
        path.resolve(absoluteBaseUrl, pathToResolve)
      ),
    })
  }
  // If there is no match-all path specified in the paths section of tsconfig, then try to match
  // all paths relative to baseUrl, this is how typescript works.
  if (!paths['*'] && addMatchAll) {
    absolutePaths.push({
      pattern: '*',
      paths: [`${absoluteBaseUrl.replace(/\/$/, '')}/*`],
    })
  }

  return absolutePaths
}

/**
 * Sort path patterns.
 * If a module name can be matched with multiple patterns then pattern with the longest prefix will be picked.
 */
function sortByLongestPrefix(arr: Array<string>): Array<string> {
  return arr
    .concat()
    .sort((a: string, b: string) => getPrefixLength(b) - getPrefixLength(a))
}

function getPrefixLength(pattern: string): number {
  const prefixLength = pattern.indexOf('*')
  return pattern.substring(0, prefixLength).length
}
