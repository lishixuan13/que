import { Plugin } from '../../plugin'
import {
  AliasOptions,
  ResolverFunction,
  ResolverObject,
  ResolvedAlias,
} from './alias'

function matches(pattern: string | RegExp, importee: string) {
  if (pattern instanceof RegExp) {
    return pattern.test(importee)
  }
  if (importee.length < pattern.length) {
    return false
  }
  if (importee === pattern) {
    return true
  }
  // eslint-disable-next-line prefer-template
  return importee.startsWith(pattern + '/')
}

function getEntries(entries: AliasOptions): readonly ResolvedAlias[] {
  if (!entries || entries.length === 0) {
    return []
  }

  if (Array.isArray(entries)) {
    return entries.map((entry) => {
      return {
        find: entry.find,
        replacement: entry.replacement,
        resolverFunction: resolveCustomResolver(entry.customResolver),
      }
    })
  }
  return Object.entries(entries).map(([key, value]) => {
    return {
      find: key,
      replacement: value,
      resolverFunction: null,
    }
  })
}

function resolveCustomResolver(
  customResolver: ResolverFunction | ResolverObject | null | undefined
): ResolverFunction | null {
  if (customResolver) {
    if (typeof customResolver === 'function') {
      return customResolver
    }
    if (typeof customResolver.resolveId === 'function') {
      return customResolver.resolveId
    }
  }
  return null
}

// function escapeNamespace(keys: string[]) {
//   return new RegExp(
//     `^${keys
//       .map((str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
//       .join('|')}$`
//   )
// }

export default function alias(alias: AliasOptions = []): Plugin {
  const entries = getEntries(alias)

  if (entries.length === 0) {
    return {
      name: 'alias',
      setup() {
        // empty
      },
    }
  }

  return {
    name: 'alias',
    setup(build) {
      // build.onStart(() => {
      //   await Promise.all(
      //     [
      //       ...(Array.isArray(options.entries) ? options.entries : []),
      //       options,
      //     ].map(
      //       ({ customResolver }) =>
      //         customResolver &&
      //         typeof customResolver === 'object' &&
      //         typeof customResolver.buildStart === 'function' &&
      //         customResolver.buildStart.call(this, inputOptions)
      //     )
      //   )
      // })

      build.onResolve({ filter: /.*/ }, (args) => {
        if (!args.resolveDir) {
          return null
        }
        // First match is supposed to be the correct one
        const matchedEntry = entries.find((entry) =>
          matches(entry.find, args.path)
        )
        if (!matchedEntry) {
          return null
        }
        const updatedId = args.path.replace(
          matchedEntry.find,
          matchedEntry.replacement
        )
        const resolveOptions = Object.assign({}, args)
        delete resolveOptions.path
        if (matchedEntry.resolverFunction) {
          return matchedEntry.resolverFunction.call(this, {
            ...resolveOptions,
            path: updatedId,
          })
        }
        return build.resolve(updatedId, resolveOptions)
      })
    },
  }
}
