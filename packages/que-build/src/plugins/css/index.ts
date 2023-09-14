import { OnLoadResult } from '@quejs/esbuild-plugin-adapter'
import { Plugin } from '../../plugin'
import { ResolvedConfig } from '../../config'
import {
  compileCSS,
  cssModulesCodeRE,
  moduleStyles,
  cssModulesCodeSuffix,
  cssLangRE,
} from './compile'
import fs from 'fs'
import { dirname } from 'path'

const inlineRE = /(\?|&)inline\b/

export default function cssPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'css',
    setup(build) {
      build.onStart(() => {
        moduleStyles.clear()
      })

      build.onResolve({ filter: cssModulesCodeRE }, async (args) => {
        return {
          path: args.path,
          namespace: cssModulesCodeSuffix,
        }
      })

      build.onLoad(
        { filter: cssModulesCodeRE, namespace: cssModulesCodeSuffix },
        (args) => {
          const code = moduleStyles.get(args.path)
          console.log('module-code', code)
          return {
            contents: code,
            loader: 'css',
            resolveDir: dirname(args.path),
          }
        }
      )

      build.onLoad({ filter: cssLangRE }, async (args) => {
        const content = await fs.promises.readFile(args.path, 'utf-8')
        const { code, moduleCode, modulePrix, errors } = await compileCSS(
          args.path,
          content,
          config,
          build
        )
        const result: OnLoadResult = {
          errors,
        }
        if (moduleCode && !inlineRE.test(args.path)) {
          result.contents = moduleCode
          result.loader = 'js'
          moduleStyles.set(modulePrix, code)
        } else {
          result.contents = code
          result.loader = 'css'
        }
        return result
      })
    },
  }
}
