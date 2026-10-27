# Changelog

Releases are git tags on GitHub. Pin one in your app's package.json with
`"vastx-native": "github:vastx-tech/vastx-native#vX.Y.Z"`. Without a tag, you get
whatever is on `main` when you install.

## Unreleased

## 3.0.0 - 2026-10-27

### Changed

- **Breaking:** the framework is now **VastX Native**, published on npm as
  `vastx-native`. The `nuxt-native` package is no longer updated. The README's
  "Coming from `nuxt-native`?" section has the migration steps. What was renamed:
  - The package and the Nuxt module: `modules: ['vastx-native']`. The
    `native: { ... }` options are unchanged.
  - The CLI is now `vastx-native` (e.g. `npx vastx-native dev android`).
  - The generated folder is now `.vastx-native/`. Existing apps reference the old
    folder in `nativescript.config.ts`, package.json `"main"`, `tsconfig.json` and
    `webpack.config.cjs`.
  - The comments marking CLI-managed blocks in `App_Resources/` now start with
    `vastx-native:`. Blocks still marked `nuxt-native:` are not recognized, and the
    CLI adds a second copy.
  - Imports from `nuxt-native/runtime/...` are now `vastx-native/runtime/...`. The
    `NuxtNativeOptions` type is now `VastXNativeOptions`.
  - Keystore environment variables are renamed from `NUXT_NATIVE_KEYSTORE_*` to
    `VASTX_NATIVE_KEYSTORE_*`.
  - The VS Code extension's command IDs are renamed from `nuxtNative.*` to `vastxNative.*`.
  - The MCP server is now `vastx-native-mcp-server`.
  - Plugins that hook into native setup must export a `"./vastx-native"` subpath
    instead of `"./nuxt-native"`.
  - The GitHub repo is now `vastx-tech/vastx-native` and the docs are at
    https://native.vastx.in. Old GitHub links redirect.

## 2.2.1 - 2026-10-15

### Added

- nuxt-native is on npm: `npx nuxt-native@latest create my-app`, or
  `npm install nuxt-native` in an existing Nuxt project.

### Fixed

- On Android, pages with a title no longer have an empty band the height of the
  status bar between the toolbar and the content.
- `dist/module.json` reports the right version. 2.2.0 said 2.1.0 there.

### Changed

- The README now opens with screenshots, a code sample and a three-line quickstart.
- package.json has npm metadata (repository, homepage, keywords), and the package
  includes CHANGELOG.md, ready for publishing to npm.

## 2.2.0 - 2026-10-15

### Added

- `v-tap="handler"`: a tap handler for any view that counts every tap on Android,
  with a ripple (`v-tap.noripple` for none). `@tap` on a layout or label drops a
  quick second tap there. Registered globally and type-checked.

### Fixed

- Builds no longer leave whitespace-only changes in `App_Resources` on Windows.
  `app.gradle` and the generated theme files keep their line endings, and aren't
  rewritten when nothing changed.

## 2.1.0 - 2026-10-15

Version 2.1.0 is the first tagged release, based on feedback from a developer
building a production app with nuxt-native.

### Fixed

- Auto-imported helpers no longer override a component's own props of the same
  name (`size`, `placeholder`, `padding`, ...). This only broke release builds.
- `<NTabs>` works again. It previously used components that NativeScript 9 no
  longer includes.
- `<NButton>` counts every tap on Android. A quick second tap used to be dropped.
- `<NPage>` no longer shows an empty toolbar on pages without a title.
- `resolveIconSvg()` no longer throws when no size is given.
- On Windows, builds no longer fail with `'gradlew.bat' is not recognized` when
  the `NoDefaultCurrentDirectoryInExePath` environment variable is set.

### Added

- `<NTabs>` keeps every tab alive, so switching tabs doesn't rebuild them, and the
  Android back button returns to the first tab.
- `useStorage(key, default)`: a ref saved on the device, restored when the app
  starts.
- Pinia stores can be saved on the device with `persist: true` or
  `persist: { pick, key }`.
- Every export in `app/composables/`, `app/utils/` and `app/stores/` is
  auto-imported, whatever the file is called. Pinia stores included.
- Names used only in templates are auto-imported and type-check. `vue-tsc` now
  also checks props of the built-in `N*` components.
- `native.theme` in nuxt.config sets the Android window background, status bar
  and accent colours, which removes the white flash between pages in dark apps.
- `native.android.minSdk` (default 23) and `native.android.stopGradleDaemon`.
- New projects get a `typecheck` script with `vue-tsc`.
- STYLING.md: Android layout pitfalls and how to debug release builds.

### Changed

- Android projects now require Android 6.0 (API 23) by default, up from 5.0.
  Current Google Play services and Firebase need it. Set
  `native.android.minSdk: 21` to keep the old minimum.
- Gradle's memory limit is now at most 2 GB, and on machines with less than 12 GB
  of RAM the Gradle daemon is stopped after each build.
