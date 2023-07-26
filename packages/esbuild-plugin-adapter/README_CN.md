<div align="center">
<h1>
  @quejs/esbuild-plugin-adapter
</h1>
</div>
<h4 align="center">
    <p>
        <a href="https://github.com/lishixuan13/que/tree/main/packages/esbuild-plugin-adapter/README.md">English</a> |
        <b>中文</b>
    <p>
</h4>
</div>

## 介绍

`esbuild plugin`适配器，使`esbuild` 的 `plugin`支持以下能力：

- resolve skipSelf
  - `esbuild`调用 `build.resolve` 会导致无限循环，需要有个类似`rollup`跳过自身的机制
- onTransform
  - `esbuild`只有`onLoad`插件，也就是说这个文件只能由一个插件处理，如果这个文件想经过多个插件处理就比较麻烦
- aop支持（待支持）

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
          // 官方的build.resolve在这种情况会导致无限循环
          // build.resolve(args.path, {
          //     resolveDir: args.resolveDir
          // })
          build.resolve(args.path, {
            resolveDir: args.resolveDir,
            // 而设置 skipSelf: true 后，就会跳过当前插件
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

原本 esbuild 的 onLoad 有加载文件+编译转换的功能，此功能都在一个插件内完成，其他插件无法参与

假设场景你写了一个.less的插件支持，这时候又有一个插件想把处理.aless文件，这个处理跟.less一样，那么他就要重写一套逻辑了

故将这两个功能拆分，onLoad只做加载文件，onTransform 做编译转换，这样不同插件onTransform就可复用

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
        // onLoad 也可返回一个虚拟的地址，提供给transform
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