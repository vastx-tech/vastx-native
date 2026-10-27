import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, extname, join } from 'node:path'

const { loadVueCompiler } = createRequire(import.meta.url)('./vue-compiler.cjs')

/**
 * Every vastx-native runtime composable, explicit and hand-maintained —
 * same precedent as RUNTIME_COMPONENTS in generate-entry.mjs, not
 * directory-scanned. `useWebSocket` specifically MUST stay a hand-listed
 * entry with its real, suffix-less specifier: it's platform-split
 * (useWebSocket.android.ts/.ios.ts), and directory-scanning would either
 * hit a duplicate-export-name conflict (both files export `useWebSocket`)
 * or resolve to one literal platform file instead of letting webpack's
 * own platform-extension list pick the right one — the same trap
 * documented in the composable's own file.
 *
 * `useWebSocket` additionally carries a `typesFrom` pointing straight at
 * the `.android` variant: TypeScript's own module resolution (used for
 * ambient auto-import types — see `renderAutoImportTypes` below) has no
 * concept of webpack's platform-extension list, so the real, suffix-less
 * runtime specifier doesn't resolve to anything for typechecking
 * purposes (no literal `useWebSocket.ts`/`.d.ts` exists, only the two
 * platform variants). Both platforms export the same interface shape, so
 * picking one for editor/typecheck purposes isn't a correctness issue —
 * the same limitation any React Native project with `.ios.ts`/`.android.ts`
 * splits lives with in an editor too.
 */
// Despite the name, also covers plain (non-"use"-prefixed) auto-imported
// helpers now — the style-object functions from src/runtime/style.ts.
// The auto-import loader itself doesn't distinguish composables from
// plain functions; this list just grew to cover both.
const VASTX_NATIVE_COMPOSABLES = [
  { name: 'useWebSocket', from: 'vastx-native/runtime/composables/useWebSocket', typesFrom: 'vastx-native/runtime/composables/useWebSocket.android.js' },
  { name: 'useCamera', from: 'vastx-native/runtime/composables/useCamera.js' },
  { name: 'useGeolocation', from: 'vastx-native/runtime/composables/useGeolocation.js' },
  { name: 'useBottomSheet', from: 'vastx-native/runtime/composables/useBottomSheet.js' },
  { name: 'useDevice', from: 'vastx-native/runtime/composables/useDevice.js' },
  { name: 'useModal', from: 'vastx-native/runtime/composables/useModal.js' },
  { name: 'useNativeRouter', from: 'vastx-native/runtime/composables/useNativeRouter.js' },
  { name: 'useSafeArea', from: 'vastx-native/runtime/composables/useSafeArea.js' },
  { name: 'useMcpClient', from: 'vastx-native/runtime/composables/useMcpClient.js' },
  { name: 'useStorage', from: 'vastx-native/runtime/composables/useStorage.js' },
  { name: 'padding', from: 'vastx-native/runtime/style.js' },
  { name: 'margin', from: 'vastx-native/runtime/style.js' },
  { name: 'bg', from: 'vastx-native/runtime/style.js' },
  { name: 'textStyle', from: 'vastx-native/runtime/style.js' },
  { name: 'box', from: 'vastx-native/runtime/style.js' },
  { name: 'size', from: 'vastx-native/runtime/style.js' },
  { name: 'flex', from: 'vastx-native/runtime/style.js' },
  { name: 'visible', from: 'vastx-native/runtime/style.js' },
  { name: 'zIndex', from: 'vastx-native/runtime/style.js' },
  { name: 'opacity', from: 'vastx-native/runtime/style.js' },
  { name: 'shade', from: 'vastx-native/runtime/style.js' },
  { name: 'tint', from: 'vastx-native/runtime/style.js' },
  { name: 'border', from: 'vastx-native/runtime/style.js' },
  { name: 'transform', from: 'vastx-native/runtime/style.js' },
  { name: 'align', from: 'vastx-native/runtime/style.js' },
  { name: 'elevation', from: 'vastx-native/runtime/style.js' },
  { name: 'direction', from: 'vastx-native/runtime/style.js' },
  { name: 'tintColor', from: 'vastx-native/runtime/style.js' },
  { name: 'placeholder', from: 'vastx-native/runtime/style.js' }
]

/**
 * Computes the full auto-import entry list for a project: vastx-native's
 * own composables above, plus every value export of every file directly
 * inside the project's own `app/composables/`, `app/utils/` and
 * `app/stores/` (mirroring Nuxt's own convention for the first two, and
 * @pinia/nuxt's default `storesDirs` for the third). Regenerated on every
 * `generateEntry()` call (init/dev/build all call it), so a file added
 * after the project's webpack.config.cjs was first written is picked up
 * on the next build — the config file itself never needs rewriting.
 *
 * Exports are read from each file's real AST, same as Nuxt's own scanner:
 * `motion.ts` exporting `fadeIn` and `slideUp` gives two entries, and no
 * entry named `motion`. (This used to assume one export named after the
 * file, which broke the generated types for any file that didn't follow
 * that — and in particular every Pinia store, since `cart.ts` exports
 * `useCartStore`.) A default export is imported under the file's name, as
 * in Nuxt. Type-only exports and `export * from` re-exports are skipped.
 */
export function collectAutoImportEntries(projectRoot, dirs = ['app/composables', 'app/utils', 'app/stores']) {
  const entries = [...VASTX_NATIVE_COMPOSABLES]
  const seen = new Set(entries.map(entry => entry.name))

  for (const relDir of dirs) {
    const dir = join(projectRoot, relDir)
    if (!existsSync(dir)) continue

    for (const file of readdirSync(dir).sort()) {
      if (!/\.(?:ts|js)$/.test(file) || /\.d\.ts$/.test(file)) continue
      // Forward-slash even on Windows: this ends up as a literal import
      // specifier in generated/read output, same reasoning as scan-pages.mjs's
      // own route `file` field.
      const from = join(dir, file).replace(/\\/g, '/')
      const fileName = basename(file, extname(file))

      for (const exported of scanValueExports(projectRoot, readFileSync(join(dir, file), 'utf8'), file)) {
        const name = exported === 'default' ? fileName : exported
        // First definition wins on a clash, vastx-native's own included —
        // the same name can't be auto-imported from two places at once.
        if (seen.has(name) || !/^[a-z_$][\w$]*$/i.test(name)) continue
        seen.add(name)
        entries.push(exported === name ? { name, from } : { name, from, export: exported })
      }
    }
  }

  return entries
}

function scanValueExports(projectRoot, code, file) {
  const { babelParse } = loadVueCompiler(projectRoot)
  let ast
  try {
    ast = babelParse(code, { sourceType: 'module', plugins: /\.ts$/.test(file) ? ['typescript'] : [] })
  } catch {
    return [] // a syntax error — the real build reports it
  }

  const names = []
  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') {
      names.push('default')
    } else if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') {
      const decl = node.declaration
      if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          if (d.id.type === 'Identifier') names.push(d.id.name)
        }
      } else if (decl && /^(?:FunctionDeclaration|ClassDeclaration|TSEnumDeclaration)$/.test(decl.type) && !decl.declare) {
        names.push(decl.id.name)
      }
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier' && spec.exportKind !== 'type') {
          names.push(spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value)
        }
      }
    }
  }
  return names
}

/**
 * Ambient global type declarations for every auto-import entry —
 * otherwise `vue-tsc`/the editor's TS server have no idea these names
 * exist (auto-import is a webpack-loader-level, build-time transform;
 * TypeScript's own resolution never sees it), and would flag every single
 * auto-imported composable/util as `Cannot find name`. Same purpose as
 * Nuxt's own generated `.nuxt/types/imports.d.ts` for its `#imports`
 * auto-import, just written by hand instead of by `unimport`'s own
 * dts-generation (which, like its webpack plugin, is ESM-only and not
 * usable from this CLI's synchronous CJS/mixed context anyway).
 */
//
// Declared twice, as Nuxt's own imports.d.ts does: as globals for <script>,
// and on ComponentCustomProperties for <template> — vue-tsc resolves a
// template name against the component instance, never against globals,
// so without the second block a name used only in a template was flagged.
// Augmenting @vue/runtime-core, not 'vue': in a native project 'vue' is
// path-mapped to nativescript-vue, which itself augments @vue/runtime-core.
//
// `components` (generate-entry.mjs's RUNTIME_COMPONENTS) become
// GlobalComponents, so <NTabs>, <NButton>, ... get real prop/event types
// in native projects too — they're registered globally at runtime, but
// vue-tsc otherwise sees them as unknown tags and checks nothing.
//
// `pinia`: when the project has pinia, also type defineStore's `persist`
// option (runtime/pinia-persist.ts). Only then — augmenting a module that
// can't be resolved is itself a type error.
export function renderAutoImportTypes(entries, components = [], { pinia = false } = {}) {
  const typeOf = ({ name, from, typesFrom, export: exported = name }) => `typeof import(${JSON.stringify(typesFrom ?? from)})['${exported}']`
  const globals = entries.map(entry => `  const ${entry.name}: ${typeOf(entry)}`).join('\n')
  const templateProps = entries.map(entry => `    readonly ${entry.name}: ${typeOf(entry)}`).join('\n')
  const globalComponents = components.map(({ tag, specifier }) => `    ${tag}: typeof import(${JSON.stringify(specifier)})['default']`).join('\n')

  return `// Generated by vastx-native — do not edit by hand, regenerated on every
// init/dev/build. Gives vue-tsc/your editor's TS server static knowledge
// of every auto-imported composable/util so they don't show as
// "Cannot find name" errors, even though no file actually imports them.
export {}
declare global {
${globals}
}
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
${templateProps}
  }
  interface GlobalComponents {
${globalComponents}
  }
  interface GlobalDirectives {
    vTap: typeof import('vastx-native/runtime/native-tap.js')['vTap']
  }
}
${pinia ? PINIA_PERSIST_TYPES : ''}`
}

const PINIA_PERSIST_TYPES = `declare module 'pinia' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface DefineStoreOptionsBase<S, Store> {
    /** Save this store's state on the device and restore it at startup. */
    persist?: boolean | import('vastx-native/runtime/pinia-persist.js').PersistOptions
  }
}
`
