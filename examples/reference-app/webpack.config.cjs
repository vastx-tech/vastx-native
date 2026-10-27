const path = require('node:path')
const webpack = require('@nativescript/webpack')
const VastXNativeAppIdentifierPlugin = require('vastx-native/cli/lib/app-identifier-webpack-plugin.cjs')

module.exports = (env) => {
  webpack.init(env)
  require('nativescript-vue/nativescript.webpack')(webpack)

  webpack.chainWebpack((config) => {
    config.resolve.alias.set(
      '#build/vastx-native/route-manifest.mjs$',
      path.resolve(__dirname, '.vastx-native/route-manifest.mjs')
    )
  })

  // Auto-import for composables (useWebSocket, useCamera, a project's own
  // app/composables/*, ...) — see auto-import-loader.cjs for why this is a
  // small first-party loader rather than the `unimport` package Nuxt
  // itself uses (unimport is ESM-only; this config file is loaded with a
  // plain, synchronous require(), which can't consume it). `enforce:
  // 'pre'` is what makes rule ordering safe here regardless of where
  // nativescript-vue's own vue-handling rules sit in the chain: pre-rules
  // are always run before normal-enforce rules, by webpack's own contract,
  // so this doesn't need to know anything about that existing rule chain.
  // Two separate rules, not one: a raw `.vue` file's own top-level text
  // (before vue-loader splits it into blocks) isn't valid JS to prepend an
  // import into, so the vue-facing rule only matches vue-loader's already
  // split-out <script> sub-request (resourceQuery contains "type=script").
  webpack.chainWebpack((config) => {
    const loaderPath = require.resolve('vastx-native/cli/lib/auto-import-loader.cjs')

    config.module.rule('vastx-native-auto-import-ts')
      .enforce('pre')
      .test(/\.ts$/)
      .exclude.add(/node_modules/).end()
      .use('vastx-native-auto-import-loader')
      .loader(loaderPath)

    config.module.rule('vastx-native-auto-import-vue-script')
      .enforce('pre')
      .test(/\.vue$/)
      .resourceQuery(/type=script/)
      .use('vastx-native-auto-import-loader')
      .loader(loaderPath)
  })

  // ForkTsCheckerWebpackPlugin (registered by @nativescript/webpack's own
  // base config whenever the project depends on "typescript", which every
  // vastx-native project does) defaults to a flat 4096 MB memory limit for
  // its separate type-checking process, regardless of the machine actually
  // running the build — the exact same class of problem
  // ensureGradleMemorySettings already fixes for Gradle's heap ceiling.
  // Reproduced directly: a real, repeated "Fatal process out of memory" /
  // "probably out of memory... check the memoryLimit option" crash on a
  // 5.74 GB total-RAM machine, traced to this exact plugin. Since
  // ts-loader itself already runs with `transpileOnly: true` (confirmed
  // directly in @nativescript/webpack's own base config), the main build
  // never needs this checker to produce a working bundle — it only adds
  // in-build type-error reporting a project already gets another way (its
  // own `vue-tsc`/`tsc` script, or the editor's own TS server). So on a
  // small machine this is pure, avoidable memory pressure with no
  // compile-time benefit, not a real tradeoff. `order: 10`: this plugin is
  // registered by a callback @nativescript/webpack's own `webpack.init(env)`
  // queues up, and needs to have already run before this one inspects the result.
  webpack.chainWebpack((config) => {
    if (!config.plugins.has('ForkTsCheckerWebpackPlugin')) return

    const totalMb = require('node:os').totalmem() / 1024 / 1024
    if (totalMb < 8192) {
      config.plugins.delete('ForkTsCheckerWebpackPlugin')
    } else {
      config.plugin('ForkTsCheckerWebpackPlugin').tap((args) => {
        args[0].typescript.memoryLimit = Math.min(4096, Math.floor(totalMb * 0.35))
        return args
      })
    }
  }, { order: 10 })

  webpack.chainWebpack((config) => {
    config
      .plugin('vastx-native-app-identifier')
      .use(VastXNativeAppIdentifierPlugin, [{ appId: "com.example.referenceapp" }])
  })

  return webpack.resolveConfig()
}
