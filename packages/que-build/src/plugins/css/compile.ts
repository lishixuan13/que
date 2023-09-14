import fs from 'fs'
import path, { dirname } from 'path'
import glob from 'fast-glob'
import postcssrc from 'postcss-load-config'
import { dataToEsm } from '@rollup/pluginutils'
import { PartialMessage, PluginBuild } from 'esbuild'
import type { RollupError } from 'rollup'
import type * as PostCSS from 'postcss'
import type * as Sass from 'sass'
// We need to disable check of extraneous import which is buggy for stylus,
// and causes the CI tests fail, see: https://github.com/vitejs/vite/pull/2860
import type Stylus from 'stylus'
import type Less from 'less'
import type { Alias } from '../alias/alias'
import {
  asyncReplace,
  syncReplace,
  cleanUrl,
  generateCodeFrame,
  isDataUrl,
  isExternalUrl,
  isObject,
} from '../../utils'
import { normalizePath } from '../../utils/path'
import { ResolvedConfig } from '../../config'

export interface CSSOptions {
  /**
   * https://github.com/css-modules/postcss-modules
   */
  modules?: CSSModulesOptions | false
  preprocessorOptions?: Record<string, any>
  postcss?:
    | string
    | (PostCSS.ProcessOptions & {
        plugins?: PostCSS.Plugin[]
      })
}

export interface CSSModulesOptions {
  getJSON?: (
    cssFileName: string,
    json: Record<string, string>,
    outputFileName: string
  ) => void
  scopeBehaviour?: 'global' | 'local'
  globalModulePaths?: RegExp[]
  generateScopedName?:
    | string
    | ((name: string, filename: string, css: string) => string)
  hashPrefix?: string
  /**
   * default: null
   */
  localsConvention?:
    | 'camelCase'
    | 'camelCaseOnly'
    | 'dashes'
    | 'dashesOnly'
    | null
}

const cssLangs = `\\.(css|less|sass|scss|styl|stylus|pcss|postcss)($|\\?)`
export const cssLangRE = new RegExp(cssLangs)
export const cssModuleRE = new RegExp(`\\.module${cssLangs}`)
export const cssModulesCodeSuffix = 'css-modules-code'
export const cssModulesCodeRE = /(\?|&)css-modules-code\b/
const varRE = /^var\(/i

const enum PreprocessLang {
  less = 'less',
  sass = 'sass',
  scss = 'scss',
  styl = 'styl',
  stylus = 'stylus',
}
const enum PureCssLang {
  css = 'css',
}
type CssLang = keyof typeof PureCssLang | keyof typeof PreprocessLang

export const isCSSRequest = (request: string): boolean =>
  cssLangRE.test(request)

// const cssModulesCache = new WeakMap<
//   ResolvedConfig,
//   Map<string, Record<string, string>>
// >()

const postcssConfigCache = new WeakMap<
  ResolvedConfig,
  PostCSSConfigResult | null
>()

type CSSAtImportResolvers = (id: string, dir?: string) => Promise<string>

interface PostCSSConfigResult {
  options: PostCSS.ProcessOptions
  plugins: PostCSS.Plugin[]
}

async function resolvePostcssConfig(
  config: ResolvedConfig
): Promise<PostCSSConfigResult | null> {
  let result = postcssConfigCache.get(config)
  if (result !== undefined) {
    return result
  }

  // inline postcss config via vite config
  const inlineOptions = config.css?.postcss
  if (isObject(inlineOptions)) {
    const options = { ...inlineOptions }

    delete options.plugins
    result = {
      options,
      plugins: inlineOptions.plugins || [],
    }
  } else {
    const searchPath =
      typeof inlineOptions === 'string' ? inlineOptions : config.root
    try {
      // @ts-ignore
      result = await postcssrc({}, searchPath)
    } catch (e) {
      if (!/No PostCSS Config found/.test(e.message)) {
        if (e instanceof Error) {
          const { name, message, stack } = e
          e.name = 'Failed to load PostCSS config'
          e.message = `Failed to load PostCSS config (searchPath: ${searchPath}): [${name}] ${message}\n${stack}`
          e.stack = '' // add stack to message to retain stack
          throw e
        } else {
          throw new Error(`Failed to load PostCSS config: ${e}`)
        }
      }
      result = null
    }
  }

  postcssConfigCache.set(config, result)
  return result
}

type CssUrlReplacer = (
  url: string,
  importer?: string
) => string | Promise<string>
type CssUrlReplacerSync = (url: string, importer?: string) => string
// https://drafts.csswg.org/css-syntax-3/#identifier-code-point
export const cssUrlRE =
  /(?<=^|[^\w\-\u0080-\uffff])url\(\s*('[^']+'|"[^"]+"|[^'")]+)\s*\)/
export const cssDataUriRE =
  /(?<=^|[^\w\-\u0080-\uffff])data-uri\(\s*('[^']+'|"[^"]+"|[^'")]+)\s*\)/
export const importCssRE = /@import ('[^']+\.css'|"[^"]+\.css"|[^'")]+\.css)/
const cssImageSetRE = /(?<=image-set\()((?:[\w\-]+\([^\)]*\)|[^)])*)(?=\))/

export function rewriteCssUrls(
  css: string,
  replacer: CssUrlReplacer
): Promise<string> {
  return asyncReplace(css, cssUrlRE, async (match) => {
    const [matched, rawUrl] = match
    return await doUrlReplace(rawUrl, matched, replacer)
  })
}

export function rewriteCssUrlsSync(css: string, replacer: CssUrlReplacerSync) {
  return syncReplace(css, cssUrlRE, (match) => {
    const [matched, rawUrl] = match
    return doUrlReplaceSync(rawUrl, matched, replacer)
  })
}

function rewriteCssDataUris(
  css: string,
  replacer: CssUrlReplacer
): Promise<string> {
  return asyncReplace(css, cssDataUriRE, async (match) => {
    const [matched, rawUrl] = match
    return await doUrlReplace(rawUrl, matched, replacer, 'data-uri')
  })
}

function rewriteImportCss(
  css: string,
  replacer: CssUrlReplacer
): Promise<string> {
  return asyncReplace(css, importCssRE, async (match) => {
    const [matched, rawUrl] = match
    return await doImportCSSReplace(rawUrl, matched, replacer)
  })
}

function doUrlReplaceSync(
  rawUrl: string,
  matched: string,
  replacer: CssUrlReplacerSync,
  funcName = 'url'
) {
  let wrap = ''
  const first = rawUrl[0]
  if (first === `"` || first === `'`) {
    wrap = first
    rawUrl = rawUrl.slice(1, -1)
  }

  if (
    isExternalUrl(rawUrl) ||
    isDataUrl(rawUrl) ||
    rawUrl.startsWith('#') ||
    varRE.test(rawUrl)
  ) {
    return matched
  }

  const newUrl = replacer(rawUrl)
  if (wrap === '' && newUrl !== encodeURI(newUrl)) {
    // The new url might need wrapping even if the original did not have it, e.g. if a space was added during replacement
    wrap = "'"
  }
  return `${funcName}(${wrap}${newUrl}${wrap})`
}

async function doUrlReplace(
  rawUrl: string,
  matched: string,
  replacer: CssUrlReplacer,
  funcName = 'url'
) {
  let wrap = ''
  const first = rawUrl[0]
  if (first === `"` || first === `'`) {
    wrap = first
    rawUrl = rawUrl.slice(1, -1)
  }

  if (
    isExternalUrl(rawUrl) ||
    isDataUrl(rawUrl) ||
    rawUrl.startsWith('#') ||
    varRE.test(rawUrl)
  ) {
    return matched
  }

  const newUrl = await replacer(rawUrl)
  if (wrap === '' && newUrl !== encodeURI(newUrl)) {
    // The new url might need wrapping even if the original did not have it, e.g. if a space was added during replacement
    wrap = "'"
  }
  return `${funcName}(${wrap}${newUrl}${wrap})`
}

async function doImportCSSReplace(
  rawUrl: string,
  matched: string,
  replacer: CssUrlReplacer
) {
  let wrap = ''
  const first = rawUrl[0]
  if (first === `"` || first === `'`) {
    wrap = first
    rawUrl = rawUrl.slice(1, -1)
  }
  if (isExternalUrl(rawUrl) || isDataUrl(rawUrl) || rawUrl.startsWith('#')) {
    return matched
  }

  return `@import ${wrap}${await replacer(rawUrl)}${wrap}`
}

// Preprocessor support. This logic is largely replicated from @vue/compiler-sfc

type PreprocessorAdditionalDataResult = string | { content: string }

type PreprocessorAdditionalData =
  | string
  | ((
      source: string,
      filename: string
    ) =>
      | PreprocessorAdditionalDataResult
      | Promise<PreprocessorAdditionalDataResult>)

type StylePreprocessorOptions = {
  [key: string]: any
  additionalData?: PreprocessorAdditionalData
  filename: string
  alias: Alias[]
}

type SassStylePreprocessorOptions = StylePreprocessorOptions & Sass.Options

type StylePreprocessor = (
  source: string,
  root: string,
  options: StylePreprocessorOptions,
  resolvers: CSSAtImportResolvers
) => StylePreprocessorResults | Promise<StylePreprocessorResults>

type SassStylePreprocessor = (
  source: string,
  root: string,
  options: SassStylePreprocessorOptions,
  resolvers: CSSAtImportResolvers
) => StylePreprocessorResults | Promise<StylePreprocessorResults>

export interface StylePreprocessorResults {
  code: string
  errors: RollupError[]
  deps: string[]
}

const loadedPreprocessors: Partial<Record<PreprocessLang, any>> = {}

function loadPreprocessor(lang: PreprocessLang.scss, root: string): typeof Sass
function loadPreprocessor(lang: PreprocessLang.sass, root: string): typeof Sass
function loadPreprocessor(lang: PreprocessLang.less, root: string): typeof Less
function loadPreprocessor(
  lang: PreprocessLang.stylus,
  root: string
): typeof Stylus
function loadPreprocessor(lang: PreprocessLang, root: string): any {
  if (lang in loadedPreprocessors) {
    return loadedPreprocessors[lang]
  }
  try {
    // Search for the preprocessor in the root directory first, and fall back
    // to the default require paths.
    const fallbackPaths = require.resolve.paths?.(lang) || []
    const resolved = require.resolve(lang, { paths: [root, ...fallbackPaths] })
    return (loadedPreprocessors[lang] = require(resolved))
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        `Preprocessor dependency "${lang}" not found. Did you install it?`
      )
    } else {
      const message = new Error(
        `Preprocessor dependency "${lang}" failed to load:\n${e.message}`
      )
      message.stack = e.stack + '\n' + message.stack
      throw message
    }
  }
}

// .scss/.sass processor
const scss: SassStylePreprocessor = async (
  source,
  root,
  options,
  resolvers
) => {
  const render = loadPreprocessor(PreprocessLang.sass, root).render
  const internalImporter: Sass.Importer = (url, importer, done) => {
    resolvers(url, dirname(importer)).then((resolved) => {
      if (resolved) {
        rebaseUrls(resolved, options.filename, options.alias)
          .then((data) => done?.(data))
          .catch((data) => done?.(data))
      } else {
        done?.(null)
      }
    })
  }
  const importer = [internalImporter]
  if (options.importer) {
    Array.isArray(options.importer)
      ? importer.push(...options.importer)
      : importer.push(options.importer)
  }

  const { content: data } = await getSource(
    source,
    options.filename,
    options.additionalData
  )
  const finalOptions: Sass.Options = {
    ...options,
    data,
    file: options.filename,
    outFile: options.filename,
    importer,
  }

  try {
    const result = await new Promise<Sass.Result>((resolve, reject) => {
      render(finalOptions, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
    const deps = result.stats.includedFiles

    return {
      code: result.css.toString(),
      errors: [],
      deps,
    }
  } catch (e) {
    // normalizePath SASS error
    e.id = e.file
    e.frame = e.formatted
    return { code: '', errors: [e], deps: [] }
  }
}

const sass: SassStylePreprocessor = (source, root, options, aliasResolver) =>
  scss(
    source,
    root,
    {
      ...options,
      indentedSyntax: true,
    },
    aliasResolver
  )

/**
 * relative url() inside \@imported sass and less files must be rebased to use
 * root file as base.
 */
async function rebaseUrls(
  file: string,
  rootFile: string,
  alias: Alias[]
): Promise<Sass.ImporterReturnType> {
  file = path.resolve(file) // ensure os-specific flashes
  // in the same dir, no need to rebase
  const fileDir = path.dirname(file)
  const rootDir = path.dirname(rootFile)
  if (fileDir === rootDir) {
    return { file }
  }

  const content = fs.readFileSync(file, 'utf-8')
  // no url()
  const hasUrls = cssUrlRE.test(content)
  // data-uri() calls
  const hasDataUris = cssDataUriRE.test(content)
  // no @import xxx.css
  const hasImportCss = importCssRE.test(content)

  if (!hasUrls && !hasDataUris && !hasImportCss) {
    return { file }
  }

  let rebased
  const rebaseFn = (url: string) => {
    if (url.startsWith('/')) return url
    // match alias, no need to rewrite
    for (const { find } of alias) {
      const matches =
        typeof find === 'string' ? url.startsWith(find) : find.test(url)
      if (matches) {
        return url
      }
    }
    const absolute = path.resolve(fileDir, url)
    const relative = path.relative(rootDir, absolute)
    return normalizePath(relative)
  }

  // fix css imports in less such as `@import "foo.css"`
  if (hasImportCss) {
    rebased = await rewriteImportCss(content, rebaseFn)
  }

  if (hasUrls) {
    rebased = await rewriteCssUrls(rebased || content, rebaseFn)
  }

  if (hasDataUris) {
    rebased = await rewriteCssDataUris(rebased || content, rebaseFn)
  }

  return {
    file,
    contents: rebased,
  }
}

// .less
const less: StylePreprocessor = async (source, root, options, resolvers) => {
  const nodeLess = loadPreprocessor(PreprocessLang.less, root)
  const viteResolverPlugin = createViteLessPlugin(
    nodeLess,
    options.filename,
    options.alias,
    resolvers
  )
  const { content } = await getSource(
    source,
    options.filename,
    options.additionalData
  )

  let result: Less.RenderOutput | undefined
  try {
    result = await nodeLess.render(content, {
      ...options,
      plugins: [viteResolverPlugin, ...(options.plugins || [])],
    })
  } catch (e) {
    const error = e as Less.RenderError
    // normalizePath error info
    const normalizedError: RollupError = new Error(error.message || error.type)
    normalizedError.loc = {
      file: error.filename || options.filename,
      line: error.line,
      column: error.column,
    }
    return { code: '', errors: [normalizedError], deps: [] }
  }

  return {
    code: result.css.toString(),
    deps: result.imports,
    errors: [],
  }
}

/**
 * Less manager, lazy initialized
 */
let ViteLessManager: any

function createViteLessPlugin(
  less: typeof Less,
  rootFile: string,
  alias: Alias[],
  resolvers: CSSAtImportResolvers
): Less.Plugin {
  if (!ViteLessManager) {
    ViteLessManager = class ViteManager extends less.FileManager {
      resolvers
      rootFile
      alias
      constructor(
        rootFile: string,
        resolvers: CSSAtImportResolvers,
        alias: Alias[]
      ) {
        super()
        this.rootFile = rootFile
        this.resolvers = resolvers
        this.alias = alias
      }
      override supports() {
        return true
      }
      override supportsSync() {
        return false
      }
      override async loadFile(
        filename: string,
        dir: string,
        opts: any,
        env: any
      ): Promise<Less.FileLoadResult> {
        const resolved = await this.resolvers(filename, dir)
        if (resolved) {
          const result = await rebaseUrls(resolved, this.rootFile, this.alias)
          let contents: string
          if (result && 'contents' in result) {
            contents = result.contents
          } else {
            contents = fs.readFileSync(resolved, 'utf-8')
          }
          return {
            filename: path.resolve(resolved),
            contents,
          }
        } else {
          return super.loadFile(filename, dir, opts, env)
        }
      }
    }
  }

  return {
    install(_, pluginManager) {
      pluginManager.addFileManager(
        new ViteLessManager(rootFile, resolvers, alias)
      )
    },
    minVersion: [3, 0, 0],
  }
}

// .styl
const styl: StylePreprocessor = async (source, root, options) => {
  const nodeStylus = loadPreprocessor(PreprocessLang.stylus, root)
  // Get source with preprocessor options.additionalData. Make sure a new line separator
  // is added to avoid any render error, as added stylus content may not have semi-colon separators
  const { content } = await getSource(
    source,
    options.filename,
    options.additionalData,
    '\n'
  )
  // Get preprocessor options.imports dependencies as stylus
  // does not return them with its builtin `.deps()` method
  const importsDeps = (options.imports ?? []).map((dep: string) =>
    path.resolve(dep)
  )
  try {
    const ref = nodeStylus(content, options)

    const result = ref.render()

    // Concat imports deps with computed deps
    const deps = [...ref.deps(), ...importsDeps]

    return {
      code: result,
      errors: [],
      deps,
    }
  } catch (e) {
    return { code: '', errors: [e], deps: [] }
  }
}

async function getSource(
  source: string,
  filename: string,
  additionalData: PreprocessorAdditionalData | undefined,
  sep = ''
): Promise<{ content: string }> {
  if (!additionalData) return { content: source }

  if (typeof additionalData === 'function') {
    const newContent = await additionalData(source, filename)
    if (typeof newContent === 'string') {
      return { content: newContent }
    }
    return newContent
  }

  return { content: additionalData + sep + source }
}

const preProcessors = Object.freeze({
  [PreprocessLang.less]: less,
  [PreprocessLang.sass]: sass,
  [PreprocessLang.scss]: scss,
  [PreprocessLang.styl]: styl,
  [PreprocessLang.stylus]: styl,
})

function isPreProcessor(lang: any): lang is PreprocessLang {
  return lang && lang in preProcessors
}

export const moduleStyles = new Map<string, string>()

export async function compileCSS(
  id: string,
  code: string,
  config: ResolvedConfig,
  build: PluginBuild
): Promise<{
  code: string
  ast?: PostCSS.Result
  modules?: Record<string, string>
  moduleCode?: string
  modulePrix?: string
  deps?: Set<string>
  errors?: PartialMessage[]
}> {
  const { modules: modulesOptions, preprocessorOptions } = config.css || {}
  const isModule = modulesOptions !== false && cssModuleRE.test(id)
  const needInlineImport = code.includes('@import')
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const hasUrl = cssUrlRE.test(code) || cssImageSetRE.test(code)
  const postcssConfig = await resolvePostcssConfig(config)
  const lang = id.match(cssLangRE)?.[1] as CssLang | undefined

  // 1. plain css that needs no processing
  if (lang === 'css' && !postcssConfig && !isModule && !hasUrl) {
    return { code }
  }

  let modules: Record<string, string> | undefined
  const deps = new Set<string>()

  const atImportResolvers: CSSAtImportResolvers = async (id, dir) =>
    (await build.resolve(id, { resolveDir: dir }))?.path

  // 2. pre-processors: sass etc.
  if (isPreProcessor(lang)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const preProcessor = preProcessors[lang]
    let opts = (preprocessorOptions && preprocessorOptions[lang]) || {}
    // support @import from node dependencies by default
    switch (lang) {
      case PreprocessLang.scss:
      case PreprocessLang.sass:
        opts = {
          includePaths: ['node_modules'],
          alias: config.resolve.alias,
          ...opts,
        }
        break
      case PreprocessLang.less:
      case PreprocessLang.styl:
      case PreprocessLang.stylus:
        opts = {
          paths: ['node_modules'],
          alias: config.resolve.alias,
          ...opts,
        }
    }
    // important: set this for relative import resolving
    opts.filename = cleanUrl(id)
    const preprocessResult = await preProcessor(
      code,
      config.root,
      opts,
      atImportResolvers
    )

    if (preprocessResult.errors.length) {
      throw preprocessResult.errors[0]
    }

    code = preprocessResult.code

    if (preprocessResult.deps) {
      preprocessResult.deps.forEach((dep) => {
        // sometimes sass registers the file itself as a dep
        if (normalizePath(dep) !== normalizePath(opts.filename)) {
          deps.add(dep)
        }
      })
    }
  }

  // 3. postcss
  const postcssOptions = (postcssConfig && postcssConfig.options) || {}
  const postcssPlugins =
    postcssConfig && postcssConfig.plugins ? postcssConfig.plugins.slice() : []

  if (isModule) {
    if (needInlineImport) {
      postcssPlugins.unshift(
        (await import('postcss-import')).default({
          async resolve(id, basedir) {
            const resolved = await atImportResolvers(id, basedir)

            if (resolved) {
              return path.resolve(resolved)
            }
            return id
          },
        })
      )
    }
  }

  if (isModule) {
    postcssPlugins.unshift(
      (await import('postcss-modules')).default({
        ...modulesOptions,
        getJSON(
          cssFileName: string,
          _modules: Record<string, string>,
          outputFileName: string
        ) {
          modules = _modules
          if (modulesOptions && typeof modulesOptions.getJSON === 'function') {
            modulesOptions.getJSON(cssFileName, _modules, outputFileName)
          }
        },
        async resolve(id: string) {
          const resolved = await atImportResolvers(id)
          if (resolved) {
            return path.resolve(resolved)
          }

          return id
        },
      })
    )
  }

  if (!postcssPlugins.length) {
    return {
      code,
    }
  }

  // postcss is an unbundled dep and should be lazy imported
  const postcssResult = await (await import('postcss'))
    .default(postcssPlugins)
    .process(code, {
      ...postcssOptions,
      to: id,
      from: id,
      map: false,
    })
  const errors: PartialMessage[] = []
  // record CSS dependencies from @imports
  for (const message of postcssResult.messages) {
    if (message.type === 'dependency') {
      deps.add(normalizePath(message.file as string))
    } else if (message.type === 'dir-dependency') {
      // https://github.com/postcss/postcss/blob/main/docs/guidelines/plugin.md#3-dependencies
      const { dir, glob: globPattern = '**' } = message
      const pattern =
        normalizePath(path.resolve(path.dirname(id), dir)) + `/` + globPattern
      const files = glob.sync(pattern, {
        ignore: ['**/node_modules/**'],
      })
      for (let i = 0; i < files.length; i++) {
        deps.add(files[i])
      }
    } else if (message.type === 'warning') {
      let msg = `[fission:css] ${message.text}`
      if (message.line && message.column) {
        msg += `\n${generateCodeFrame(code, {
          line: message.line,
          column: message.column,
        })}`
      }
      errors.push({
        text: msg,
      })
    }
  }
  let moduleCode
  let modulePrix
  if (isModule) {
    modulePrix = id + (id.includes('?') ? '&' : '?') + cssModulesCodeSuffix
    moduleCode = `import "${modulePrix}";\n`
    moduleCode += dataToEsm(modules, {
      namedExports: true,
      preferConst: true,
    })
  }
  return {
    ast: postcssResult,
    code: postcssResult.css,
    modules,
    modulePrix,
    moduleCode,
    deps,
    errors,
  }
}

export function formatCssError(
  error: RollupError,
  pluginName?: string
): PartialMessage {
  return {
    pluginName: pluginName,
    text: error.message,
    location: error.loc
      ? {
          file: error.loc.file,
          line: error.loc.line,
          column: error.loc.column,
        }
      : null,
  }
}
