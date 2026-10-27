import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { scanPages } from './scan-pages.mjs'
import { collectAutoImportEntries, renderAutoImportTypes } from './auto-imports.mjs'

const OUT_DIR = '.vastx-native'

/**
 * Path (relative to project root) to the generated bootstrap entry —
 * shared with nativescript-config.mjs and scaffold-templates.mjs, which
 * both need to point at it (nativescript.config.ts's `main` field and
 * package.json's `main` fallback) so @nativescript/webpack's
 * getEntryPath() can find it instead of throwing on an undefined path.
 */
export const ENTRY_FILE = `${OUT_DIR}/app.js`

/**
 * Regenerates the standalone native bootstrap: a route manifest (mirroring
 * what the Nuxt module generates for editor/type-checking DX, see
 * src/build/generate-routes.ts) plus the actual entry file NativeScript's
 * webpack build loads on-device. This is intentionally decoupled from
 * Nuxt's own Vite/Nitro build — there is no server response to render and
 * no DOM to hydrate, so the on-device bundle is produced by NativeScript's
 * own webpack toolchain instead of nuxi.
 */
export function generateEntry({ projectRoot = process.cwd(), pagesDir = 'app/pages' } = {}) {
  const outDir = join(projectRoot, OUT_DIR)
  const resolvedPagesDir = resolve(projectRoot, pagesDir)

  if (!existsSync(resolvedPagesDir)) {
    throw new Error(`[vastx-native] Pages directory not found: ${resolvedPagesDir}`)
  }

  const routes = scanPages(resolvedPagesDir)
  if (routes.length === 0) {
    throw new Error(`[vastx-native] No .vue pages found in ${resolvedPagesDir}`)
  }

  const initial = routes.find(r => r.name === 'index') ?? routes[0]

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'route-manifest.mjs'), renderManifest(routes))
  writeFileSync(join(outDir, 'root-frame.vue'), renderRootFrame(initial))
  const components = collectUsedComponents(join(projectRoot, 'app'))
  const needsSvg = components.some(({ tag }) => tag === 'NSvg' || tag === 'NIconButton')
  writeFileSync(join(outDir, 'app.js'), renderAppEntry({ components, usePinia: isPiniaInstalled(projectRoot), useUiSvg: needsSvg && isUiSvgInstalled(projectRoot) }))

  // @nativescript/webpack's app-css-loader resolves "./app.css" relative to
  // the entry file's own directory (confirmed against its source) — i.e.
  // .vastx-native/app.css, not the project's real app/app.css. That real
  // file is the one thing here users actually author (Tailwind directives,
  // custom CSS); everything else in .vastx-native/ is generated. So this
  // copies it into place on every generate pass, same as the other
  // generated files, instead of asking users to hand-maintain a duplicate.
  // Optional: projects that don't use app/app.css (or predate this feature)
  // just don't get one, and app-css-loader silently no-ops on a missing file.
  const appCssPath = resolve(projectRoot, 'app/app.css')
  if (existsSync(appCssPath)) {
    copyFileSync(appCssPath, join(outDir, 'app.css'))
  }

  // Data, not config: webpack.config.cjs's auto-import loader (see
  // auto-import-loader.cjs) reads this fresh at build time, so a
  // composable added to app/composables/ after the project's
  // webpack.config.cjs was first written is picked up on the very next
  // build/dev run without needing that static config file rewritten.
  const autoImportEntries = collectAutoImportEntries(projectRoot)
  writeFileSync(join(outDir, 'auto-imports.json'), JSON.stringify(autoImportEntries))
  writeFileSync(join(outDir, 'auto-imports.d.ts'), renderAutoImportTypes(autoImportEntries, RUNTIME_COMPONENTS, { pinia: isPiniaInstalled(projectRoot) }))

  return { routes, initial, outDir }
}

function renderManifest(routes) {
  const entries = routes.map(route => [
    '  {',
    `    name: ${JSON.stringify(route.name)},`,
    `    path: ${JSON.stringify(route.path)},`,
    `    params: ${JSON.stringify(route.params)},`,
    `    component: () => import(${JSON.stringify(route.file)})`,
    '  }'
  ].join('\n'))

  return `export const routes = [\n${entries.join(',\n')}\n]\n`
}

function renderRootFrame(initial) {
  return `<template>
  <Frame>
    <Initial />
  </Frame>
</template>

<script setup>
import Initial from ${JSON.stringify(initial.file)}
</script>
`
}

// The Nuxt module's addComponentsDir() registers <NPage>/<NActionBar>/
// <NTabs> globally for Nuxt's own build (editor DX, vue-tsc) — the native
// webpack build never goes through that, so nothing registers them there
// at all. Global .component() calls here are nativescript-vue's
// equivalent: the same mechanism Nuxt itself ultimately relies on
// (Vue's app-level component registry), just invoked directly instead of
// through Nuxt's auto-import codegen.
const RUNTIME_COMPONENTS = [
  { tag: 'NPage', specifier: 'vastx-native/runtime/components/NPage.vue' },
  { tag: 'NActionBar', specifier: 'vastx-native/runtime/components/NActionBar.vue' },
  { tag: 'NTabs', specifier: 'vastx-native/runtime/components/NTabs.vue' },
  { tag: 'NFlex', specifier: 'vastx-native/runtime/components/NFlex.vue' },
  { tag: 'NButton', specifier: 'vastx-native/runtime/components/NButton.vue' },
  { tag: 'NText', specifier: 'vastx-native/runtime/components/NText.vue' },
  { tag: 'NInput', specifier: 'vastx-native/runtime/components/NInput.vue' },
  { tag: 'NCard', specifier: 'vastx-native/runtime/components/NCard.vue' },
  { tag: 'NSwitch', specifier: 'vastx-native/runtime/components/NSwitch.vue' },
  { tag: 'NSpinner', specifier: 'vastx-native/runtime/components/NSpinner.vue' },
  { tag: 'NAvatar', specifier: 'vastx-native/runtime/components/NAvatar.vue' },
  { tag: 'NBadge', specifier: 'vastx-native/runtime/components/NBadge.vue' },
  { tag: 'NDivider', specifier: 'vastx-native/runtime/components/NDivider.vue' },
  { tag: 'NContainer', specifier: 'vastx-native/runtime/components/NContainer.vue' },
  { tag: 'NetworkImage', specifier: 'vastx-native/runtime/components/NetworkImage.vue' },
  { tag: 'CachedImage', specifier: 'vastx-native/runtime/components/CachedImage.vue' },
  { tag: 'NSkeleton', specifier: 'vastx-native/runtime/components/NSkeleton.vue' },
  // NSvg/NIconButton are available for selective registration too — they compile fine
  // without @nativescript-community/ui-svg installed, since their own
  // templates only reference the <SVGView> tag name as a string, resolved
  // at runtime through nativescript-vue's element registry (see
  // isUiSvgInstalled() below). Only that registry entry is conditional.
  { tag: 'NSvg', specifier: 'vastx-native/runtime/components/NSvg.vue' },
  { tag: 'NIconButton', specifier: 'vastx-native/runtime/components/NIconButton.vue' }
  // NBottomSheet deliberately excluded: it's shown imperatively via
  // useBottomSheet()'s $showModal call (which references it by direct JS
  // import, not by template tag name), never used as a template tag
  // itself, so it needs no global registration here.
]

/** Scan project templates; a dynamic component may select any registered tag. */
export function collectUsedComponents(appDir) {
  const used = new Set()
  let dynamic = false
  function visit(dir) {
    if (!existsSync(dir)) return
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name)
      if (item.isDirectory()) visit(path)
      else if (item.name.endsWith('.vue')) {
        const source = readFileSync(path, 'utf8')
        const clean = source
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
        if (/<component\b/i.test(clean)) dynamic = true
        for (const match of clean.matchAll(/<([a-z][\w-]*)\b/gi)) {
          const tag = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
          used.add(tag[0].toUpperCase() + tag.slice(1))
        }
      }
    }
  }
  visit(appDir)
  return dynamic ? RUNTIME_COMPONENTS : RUNTIME_COMPONENTS.filter(({ tag }) => used.has(tag))
}

/**
 * Optional, first-class Pinia support: wired into the bootstrap only if
 * the project actually depends on `pinia` (checked below), never forced.
 *
 * Why this is safe on a runtime with no DOM at all: Pinia's own dist
 * (`pinia.js`, the one file its package.json `exports` map resolves to
 * unconditionally) has zero references to `document`/`localStorage`/
 * `navigator`, and its one real runtime dependency (`nostics`, a
 * zero-dependency diagnostic-message formatter) has none either — checked
 * by downloading both via `npm pack` and grepping their actual dist
 * output, not assumed from the package description. Its every DOM/
 * devtools-only code path (`registerPiniaDevtools`, the devtools plugin
 * itself, a `saveAs` file-download helper) is gated behind a single
 * `IS_CLIENT = typeof window !== "undefined"` check — and NativeScript's
 * runtime never defines a global `window` (confirmed by grepping
 * @nativescript/core for one), so every one of those branches is simply
 * never taken at runtime, the same way they wouldn't be during SSR.
 * `@vue/devtools-api` (pinia's one non-optional peer dependency — its
 * `setupDevtoolsPlugin` import is static, so webpack needs it resolvable
 * even though `IS_CLIENT` means it's never actually called) was checked
 * the same way: zero `window` references in its own main entry.
 * Everything Pinia's core imports from `vue` (`effectScope`,
 * `getCurrentInstance`, `inject`, `markRaw`, `toRaw`, `toRefs`, ...)
 * resolves correctly through the existing `vue` → `nativescript-vue` alias,
 * since `nativescript-vue`'s own entry does `export * from
 * '@vue/runtime-core'` (confirmed directly), and its pinned
 * `@vue/runtime-core` version satisfies Pinia's `vue: ^3.5.11` peer
 * requirement with room to spare.
 */
function isPiniaInstalled(projectRoot) {
  try {
    createRequire(join(projectRoot, 'package.json')).resolve('pinia')
    return true
  } catch {
    return false
  }
}

/**
 * NSvg/NIconButton (see their own files) compile fine without
 * @nativescript-community/ui-svg installed — their templates only
 * reference the <SVGView> tag name as a string. But using them at
 * runtime needs that tag actually registered against the real SVGView
 * class first (registerElement(), the same real nativescript-vue API
 * every built-in native element — GridLayout, ScrollView, ... — is
 * registered with, confirmed directly in its own elements.js), which
 * does need a real import. Optional and detected the same way Pinia is:
 * only emitted if the consuming app actually depends on it, so apps that
 * never touch NSvg/NIconButton don't carry a native SVG-rendering
 * dependency they never asked for.
 */
function isUiSvgInstalled(projectRoot) {
  try {
    createRequire(join(projectRoot, 'package.json')).resolve('@nativescript-community/ui-svg')
    return true
  } catch {
    return false
  }
}

function renderAppEntry({ components = RUNTIME_COMPONENTS, usePinia, useUiSvg } = {}) {
  const imports = components
    .map(({ tag, specifier }) => `import ${tag} from ${JSON.stringify(specifier)}`)
    .join('\n')
  const registrations = components
    .map(({ tag }) => `  .component(${JSON.stringify(tag)}, ${tag})`)
    .join('\n')

  // piniaPersist only acts on stores that opt in with `persist`.
  const piniaImport = usePinia ? `import { createPinia } from 'pinia'\nimport { piniaPersist } from 'vastx-native/runtime/pinia-persist.js'\n` : ''
  const piniaUse = usePinia ? '  .use(createPinia().use(piniaPersist))\n' : ''

  const uiSvgImport = useUiSvg ? `import { SVGView } from '@nativescript-community/ui-svg'\n` : ''
  // app.registerElement(...) — confirmed a real chainable method on the
  // created app (App.registerElement: typeof registerElement in
  // nativescript-vue's own index.d.ts, alongside the standalone
  // registerElement export this uses the same way), so this fits
  // straight into the existing .component()/.use() chain below instead
  // of a separate standalone call.
  const uiSvgRegister = useUiSvg ? `  .registerElement('SVGView', () => SVGView)\n` : ''

  return `import { createApp } from 'nativescript-vue'
import { applyLabelClippingFix } from 'vastx-native/runtime/label-clipping-fix.js'
import { vTap } from 'vastx-native/runtime/native-tap.js'
${piniaImport}${uiSvgImport}import RootFrame from './root-frame.vue'
${imports}

applyLabelClippingFix()

createApp(RootFrame)
${piniaUse}${uiSvgRegister}  .directive('tap', vTap)
${registrations}
  .start()
`
}
