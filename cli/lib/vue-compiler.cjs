'use strict'

// The same compiler vue-loader itself uses (its compiler.js tries
// `vue/compiler-sfc`, then `@vue/compiler-sfc`), resolved from the project
// first so our own parsing always agrees with the real build. Shared by
// auto-import-loader.cjs (per-file analysis) and auto-imports.mjs (export
// scanning of app/composables + app/utils).
let cachedCompiler = null

function loadVueCompiler(projectRoot) {
  if (cachedCompiler) return cachedCompiler
  for (const id of ['vue/compiler-sfc', '@vue/compiler-sfc']) {
    try {
      cachedCompiler = require(require.resolve(id, { paths: [projectRoot, __dirname] }))
      return cachedCompiler
    } catch {
      // not installed under this name; try the next one
    }
  }
  throw new Error('vastx-native: could not resolve vue/compiler-sfc (normally installed with nativescript-vue)')
}

module.exports = { loadVueCompiler }
