'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Writes `<output>/package.json` with the project's real app id and the
 * actual emitted entry chunk filename — read from webpack's own
 * compilation output, not guessed ahead of time.
 *
 * Why this can't be a pre-build guess (an earlier version of this fix
 * was): `com.tns.Module.bootstrapApp` (NativeScript's native runtime
 * bootstrap) reads this exact file's `main` field to find the entry
 * chunk at app launch — get it wrong and the app crashes on launch with
 * "Application entry point file not found", confirmed directly. The
 * entry chunk's extension (`bundle.js` vs `bundle.mjs`) turned out to
 * differ between two real, near-identically-scaffolded projects in this
 * framework's own testing, and reading through `@nativescript/webpack`'s
 * own CommonJS-vs-ESM output branch (`configuration/base.js`) didn't
 * explain why on its own — rather than keep guessing, this reads
 * webpack's own compilation result directly, which always knows.
 *
 * (Same class of file this framework also needs for a second, separate
 * reason — Gradle's own `computeNamespace()`, in `platforms/android/app/
 * build.gradle`, reads this same file's `id` field to set the app's real
 * package name, with no fallback other than NativeScript's literal
 * default `"com.tns.testapplication"`. That part doesn't need the real
 * bundle filename, but writing both fields from the one place webpack
 * actually knows the answer is simpler than splitting it across a
 * pre-build guess and a post-build correction.)
 */
class VastXNativeAppIdentifierPlugin {
  constructor(options) {
    this.appId = options.appId
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tap('VastXNativeAppIdentifierPlugin', (compilation) => {
      const bundleAsset = Object.keys(compilation.assets).find(name => /^bundle\.m?js$/.test(name))
      if (!bundleAsset) return // no "bundle" entry in this compilation (e.g. a non-app build) — nothing to do

      const outputPath = compilation.options.output.path
      const packageJsonPath = path.join(outputPath, 'package.json')
      const content = JSON.stringify({ id: this.appId, main: bundleAsset }) + '\n'

      if (fs.existsSync(packageJsonPath) && fs.readFileSync(packageJsonPath, 'utf8') === content) return
      fs.writeFileSync(packageJsonPath, content)
    })
  }
}

module.exports = VastXNativeAppIdentifierPlugin
