## example

```javascript

build({
    plugins: [warnPlugins([{
        name: 'my-plugin',
        setup(build) {
            build.onResolve({ filter: /^images\// }, args => {
                return { path: path.join(args.resolveDir, 'public', args.path) }
            })
            build.onOnload()
            build.onTransform()
        }
    }])]
})

```