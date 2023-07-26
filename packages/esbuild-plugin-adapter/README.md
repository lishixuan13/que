<div align="center">
<h1>
  @quejs/esbuild-plugin-adapter
</h1>
</div>
<h4 align="center">
    <p>
        <b>English</b> |
        <a href="https://github.com/lishixuan13/que/tree/main/packages/esbuild-plugin-adapter/README_CN.md">中文</a>
    <p>
</h4>
</div>

## Introduction

The `esbuild plugin` adapter enables the `plugin` of `esbuild` to support the following capabilities:

- resolve skipSelf
  - Calling `build. resolve` on `esbuild` will result in an infinite loop, and a mechanism similar to `rollup` is needed to skip itself
- onTransform
  - Esbuild only has the `onLoad` plugin, which means that this file can only be processed by one plugin. If this file wants to be processed by multiple plugins, it will be more troublesome
- AOP support (to be supported)

## example

### resolve skipSelf 

```javascript
import { build } from "esbuild";
import { createAdapterPlugins } from "@quejs/esbuild-plugin-adapter";

build({
  plugins: createAdapterPlugins([
    {
      name: "my-plugin",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          console.log("my-plugin");
          // The build.resolve of Esbuild can lead to infinite loops in this situation
          // build.resolve(args.path, {
          //     resolveDir: args.resolveDir
          // })
          build.resolve(args.path, {
            resolveDir: args.resolveDir,
            // After setting skipSelf: true, the current plugin will be skipped
            skipSelf: true,
          });
        });
      },
    },
    {
      name: "other-plugin",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          console.log("other-plugin");
        });
      },
    },
  ]),
});
```

### onTransform

The onLoad of the original esbuild has the function of loading files and compiling and converting, which is all completed within one plugin, and other plugins cannot participate

Assuming you have written a plugin support for. less in a scenario, and there is another plugin that wants to process. less files the same way as. less, then it needs to rewrite a set of logic

So split these two functions, onLoad only does loading files, and onTransform does compilation and conversion, so that different plugins onTransform can be reused

```javascript
import { build } from "esbuild";
import { createAdapterPlugins } from "@quejs/esbuild-plugin-adapter";

build({
  plugins: createAdapterPlugins([
    {
      name: "my-plugin",
      setup(build) {
        build.onLoad({ filter: /\.less$/ }, (args) => {
          return {
            contents: ".red { color: red; }",
            loader: "css",
          };
        });

        build.onTransform({ filter: /\.less$/ }, (result) => {
          const loadContexts = result.contents;
          return {
            contents: loadContexts + "\n .blue { color: blue; }",
            loader: "css",
          };
        });
      },
    },
    {
      name: "other-plugin",
      setup(build) {
        // OnLoad can also return a virtual address to the transform
        build.onLoad({ filter: /\.lass$/ }, (args) => {
          return {
            contents: ".green { color: green; }",
            loader: "css",
            virtualPath: ".less",
          };
        });
      },
    },
  ]),
});
```