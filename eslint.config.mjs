import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true
  }
}).append({
  // The VS Code extension is a separate package with its own
  // package.json/tsconfig.json/node_modules — only its compiled output
  // needs excluding here (its own `src/` is plain TS, already valid input
  // for this same config).
  ignores: ['dist/**', 'vscode-extension/out/**', 'vscode-extension/node_modules/**', 'mcp-server/node_modules/**']
}).append({
  // Nuxt's file-based routing names pages by their file (index.vue,
  // [id].vue) — the multi-word rule exists to avoid clashing with native
  // HTML elements, which doesn't apply to files vastx-native's router
  // resolves by path, never registers as a global component.
  files: ['playground/app/pages/**/*.vue', 'examples/*/app/pages/**/*.vue'],
  rules: {
    'vue/multi-word-component-names': 'off'
  }
}).append({
  // Direct Java/Objective-C interop (OkHttp's WebSocket API on Android,
  // NSURLSessionWebSocketTask's delegate callbacks on iOS) — the actual
  // native callback parameter types either have no npm type definitions
  // at all (OkHttp) or are typed loosely enough by @nativescript/types
  // that real interop code genuinely needs `any` at these boundaries,
  // the same way @nativescript/core's own native-callback code (e.g.
  // AttachListener in ui/frame/index.android.js) is untyped plain JS.
  files: ['src/runtime/composables/useWebSocket.*.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
}).append({
  // NativeScript's renderer APIs expose event payloads and directive hooks
  // without narrow types; this bridge intentionally handles those values.
  files: ['src/runtime/vue-compat.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
}).append({
  // nativescript-vue's own renderer does NOT camelize kebab-case template
  // attributes for native (non-SFC) elements the way Vue's DOM renderer
  // does for real HTML — confirmed directly in its dist/dom/index.js and
  // dist/renderer/patchProp.js: a template attribute name is passed
  // completely literally into the npm `set-value` package against the
  // native view, with no hyphenate/camelize step anywhere in that path.
  // `:action-bar-hidden="x"` on a native `<Page>` therefore assigns a
  // literal `nativeView['action-bar-hidden']` — a property nothing reads
  // — instead of `nativeView.actionBarHidden`, silently no-opping. This
  // is exactly backwards from `vue/attribute-hyphenation`'s own default
  // (kebab-case preferred, matching real DOM/HTML conventions), which
  // would have auto-"fixed" every genuine bugfix in this exact class back
  // into the same bug. Every `.vue` file in this repo targets
  // nativescript-vue's renderer, never a DOM one, so this flips the rule
  // to require camelCase everywhere instead.
  files: ['**/*.vue'],
  rules: {
    'vue/attribute-hyphenation': ['error', 'never']
  }
}).append({
  // Ambient .d.ts files describe shape only — `class` with only static
  // members or an empty body is exactly how you declare a native class's
  // type surface without a runtime implementation, unlike the rule's
  // normal target (an accidentally-static-only class in real, executed
  // code).
  files: ['**/*.d.ts'],
  rules: {
    '@typescript-eslint/no-extraneous-class': 'off'
  }
})
