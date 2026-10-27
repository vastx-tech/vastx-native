import { readFileSync } from 'node:fs'
import { ENTRY_FILE } from './generate-entry.mjs'

// Until vastx-native is published to npm, generated projects depend on it
// straight from GitHub, pinned to the release tag of the vastx-native that
// created them (scripts/release.mjs tags every version as vX.Y.Z). Without
// the tag, every install would take whatever is on main that day, so two
// machines could build the same app with different framework code.
// Once it's published to npm, this is the one line to change.
const { version: VASTX_NATIVE_VERSION } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
export const VASTX_NATIVE_DEPENDENCY_SPEC = `github:vastx-tech/vastx-native#v${VASTX_NATIVE_VERSION}`

export function packageJson(appName, dependencySpec = VASTX_NATIVE_DEPENDENCY_SPEC, styling = 'native') {
  return `${JSON.stringify(
    {
      name: appName,
      private: true,
      // Deliberately NOT "type": "module". This project's own generated
      // files (webpack.config.cjs, .vastx-native/app.js — the latter only
      // ever consumed through webpack's own module system, never Node's)
      // don't need it, but NativeScript's Android runtime ships plain
      // CommonJS build tooling under platforms/android/build-tools/ that
      // does — those files have no closer package.json of their own, so
      // Node resolves their module type from THIS one. With "type":
      // "module" set, Node treats that vendored CommonJS script as ESM
      // too and `require` throws `ReferenceError: require is not defined`
      // — reproduced by a real user's `ns run android` deploy step.
      // Fallback only: nativescript.config.ts's own `main` field (set by
      // ensureNativeScriptConfig) is checked first by
      // @nativescript/webpack's getEntryPath() — this covers the case
      // where that field is somehow not read (see its own comment for why
      // that's not just theoretical).
      main: ENTRY_FILE,
      scripts: {
        'native:init': 'vastx-native init',
        'native:dev:ios': 'vastx-native dev ios',
        'native:dev:android': 'vastx-native dev android',
        'native:build:ios': 'vastx-native build ios --release',
        'native:build:android': 'vastx-native build android --release',
        // Type-checks .vue files too, against the auto-import and component
        // types vastx-native generates in .vastx-native/ on every init/dev/build.
        typecheck: 'vue-tsc --noEmit'
      },
      dependencies: {
        'vastx-native': dependencySpec,
        'nativescript-vue': '^3.1.2',
        '@nativescript/core': '^9.1.2',
        nuxt: '^4.0.0'
      },
      devDependencies: {
        // Required by `ns build`/`ns run` directly (it looks for this exact
        // package name as a project dependency) — pinned to the same range
        // nativescript-vue itself builds and tests against.
        '@nativescript/webpack': '~5.0.38',
        // ts-loader (a dependency of @nativescript/webpack) peer-depends on
        // this — @nativescript/webpack only lists it in ITS OWN
        // devDependencies (used to build itself), which are never installed
        // transitively for consumers. Without it, ts-loader's own compiler
        // resolution (`require('typescript')`) throws, gets swallowed into
        // an unused error message, and it presses on with `compiler`
        // undefined — crashing on `compiler.sys.fileExists` the moment it
        // tries to locate a tsconfig. Confirmed by reading ts-loader's
        // compilerSetup.js directly; reproduced by a real user's build log.
        typescript: '~5.8.0',
        'vue-tsc': '^2.2.0',
        // Pinned to the 3.x line deliberately, not "latest" (which is now
        // Tailwind v4): tailwind.config.cjs's `corePlugins` allowlist below
        // is a v3-only, JS-config API — v4 moved to CSS-first config and
        // dropped it. See tailwind.config.cjs's own comment for why that
        // allowlist (not the full utility set) is what's actually safe to
        // generate against NativeScript's CSS engine.
        ...(styling === 'tailwind' ? { tailwindcss: '^3.4.19', postcss: '^8.5.28' } : {})
      }
    },
    null,
    2
  )}\n`
}

export function projectReadme(styling = 'native') {
  return `# VastX Native app

Run on Android with \`npx vastx-native dev android\` (or use \`ios\` on macOS).

${styling === 'tailwind' ? 'This project uses Tailwind v3 with the NativeScript adapter. Read STYLING.md before changing layout or spacing.' : 'This project uses native style objects. Add app/app.css for shared NativeScript CSS, or choose --styling tailwind when creating a project.'}

## AI coding agents (MCP)

The framework includes an optional MCP server. Install its dependencies first:

\`npm install -D @modelcontextprotocol/sdk zod\`

No separate clone or server folder is needed.
Configure your agent to launch \`npx vastx-native mcp\` from this project directory.
The agent starts and stops the server; you do not need to run it in another terminal.
It uses stdio, so a manual launch waits for MCP messages rather than opening a web page.

For clients using the \`mcpServers\` format, such as Claude Code's \`.mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "vastx-native": {
      "command": "npx",
      "args": ["vastx-native", "mcp"]
    }
  }
}
\`\`\`

If your Windows client cannot launch npx directly, use command \`cmd\` and
args \`["/c", "npx", "vastx-native", "mcp"]\`.
For clients launched elsewhere, set their working directory to this project or
use command \`node\` with the absolute path to
\`node_modules/vastx-native/bin/vastx-native.mjs\` followed by \`mcp\` as arguments.

Try: "Use vastx-native to run doctor and lint for this project's absolute path,
then build Android, install it on my connected device, and check the logs.
Run the steps sequentially."

Tools include doctor, lint, build, list_devices, install_and_launch, read_logs,
analyze, version, and clean. Pass the app's absolute path as projectPath when
the tool requests it. Native builds still require the platform SDK and JDK;
Android installation and logs require ADB and a connected device or emulator.
This development server is separate from the app's useMcpClient() HTTP client.
`
}

export function nuxtConfig(appId, appName, styling = 'native') {
  return `export default defineNuxtConfig({
  modules: ['vastx-native'],
  compatibilityDate: '${new Date().toISOString().slice(0, 10)}',

  native: {
    appId: ${JSON.stringify(appId)},
    appName: ${JSON.stringify(appName)},
    styling: ${JSON.stringify(styling)},
    // Android window background, status bar and accent. Match these to
    // your app's colours (a dark background switches to a dark system
    // theme) so no white shows between pages.
    theme: {
      background: '#F8FAFC',
      primary: '#4F46E5'
    }
  }
})
`
}

export function tsconfig() {
  // A real, standalone config — not Nuxt's usual references-only shell
  // pointing at .nuxt/tsconfig.*.json. That style only works once `nuxi
  // prepare`/`nuxi dev` has generated `.nuxt/`, which never happens in this
  // framework's actual workflow (see ARCHITECTURE.md on why the native
  // build bypasses Nuxt's own builder entirely). More importantly,
  // @nativescript/webpack's ts-loader rule reads this exact file directly
  // via getProjectTSConfigPath() to compile <script lang="ts"> blocks in
  // .vue pages — a references-only config with no real `compilerOptions`
  // would leave it with nothing usable even once `typescript` itself is
  // installed (see the typescript devDependency comment in packageJson()
  // for the other half of this bug). Trade-off: editor auto-import
  // IntelliSense for composables/components still needs `npx nuxi prepare`
  // run at least once — this file prioritizes a working native build.
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        // Required for TS18003 "No inputs were found": TypeScript's own
        // `include` glob-matching filters by a hardcoded extension list
        // (.ts/.d.ts, plus .js only with this flag) no matter what the
        // glob pattern spells — listing "*.vue" in `include` does not
        // register .vue as a recognized extension. None of our generated
        // files are bare .ts, so without allowJs literally nothing in
        // `include` ever counts as a root file. With it, .vastx-native/
        // app.js (plain JS) does, which is enough to satisfy "at least
        // one input" — reproduced/fixed via a real webpack compile, not
        // just config resolution.
        allowJs: true,
        isolatedModules: true,
        // nativescript-vue re-exports the full Vue Composition API
        // alongside its native createApp — mapping the bare "vue"
        // specifier here is what makes `import { ref } from 'vue'`
        // type-check correctly against it (nativescript-vue's own
        // documented recommendation for consumers).
        paths: {
          vue: ['./node_modules/nativescript-vue']
        }
      },
      // nuxt.config.ts deliberately excluded: it's never bundled into the
      // native entry, only read by Nuxt's own tooling — but including it
      // here puts it in scope for @nativescript/webpack's
      // ForkTsCheckerWebpackPlugin (which activates now that `typescript`
      // is an actual dependency), and it fails there since `defineNuxtConfig`
      // is an ambient global Nuxt's own generated types provide, which we
      // don't have without running `nuxi prepare`. Reproduced directly via
      // a real `webpack()` compilation, not just config resolution.
      //
      // Explicit per-extension globs, not a bare "app/**/*": TypeScript's
      // own `include` glob-matching only recognizes .ts/.d.ts (and .js
      // only with allowJs) when enumerating root files for the config —
      // it has no special awareness of .vue (that comes from vue-tsc,
      // which plain ts-loader here doesn't use). A pattern matching zero
      // recognized-extension files makes `ts.parseJsonConfigFileContent`
      // fail with TS18003 "No inputs were found", which `ts-loader`
      // treats as fatal — reproduced directly via a real webpack compile.
      include: [
        'app/**/*.ts',
        'app/**/*.vue',
        '.vastx-native/**/*.js',
        '.vastx-native/**/*.mjs',
        '.vastx-native/**/*.vue',
        // Ambient auto-import declarations (see auto-imports.mjs's
        // renderAutoImportTypes) — without this, vue-tsc/the editor's TS
        // server would flag every auto-imported composable/util as
        // "Cannot find name", even though the actual build resolves them
        // correctly via the auto-import webpack loader.
        '.vastx-native/**/*.d.ts'
      ]
    },
    null,
    2
  )}\n`
}

export function gitignore() {
  return `.output
.data
.nuxt
.nitro
.cache
dist
node_modules
.vastx-native
platforms
hooks
*.hprof
.env
.env.*
!.env.example
`
}

// The full property list NativeScript's CSS engine actually recognizes,
// confirmed by grepping every `cssName:` registration across
// @nativescript/core/ui/ (not just style-properties.js — text-align,
// letter-spacing, etc. live in separate files). Deliberately excluded from
// the allowlist below even though the property names would match:
//  - display/position/top/right/bottom/left/overflow/float/cursor/
//    pointer-events: NativeScript has no concept of any of these at all —
//    layout is chosen by container type (FlexboxLayout/GridLayout/
//    AbsoluteLayout), never by a `position` CSS property.
//  - transition-*/animation-*: NativeScript has its own imperative
//    Animation API, not CSS transitions.
//  - rotate/scale/translate/skew and the `transform` shorthand: Tailwind
//    v3 composes these from CSS custom properties (`translate(var(
//    --tw-translate-x), ...)`), but NativeScript's transform value parser
//    (see convertToTransform in style-properties.js) expects literal
//    numbers, not `var()` references — confirmed by reading that parser
//    directly. Enabling these plugins would generate classes that
//    silently do nothing.
//  - space (space-x/space-y), ring, divide, backdropFilter: rely on
//    sibling-combinator selectors or CSS features not confirmed to work
//    against NativeScript's css-tree-based engine.
//  - gap: confirmed on a real Android device that a non-zero row-gap on
//    a <FlexboxLayout> (<NFlex>) silently drops its last child from the
//    native view tree entirely (reproduced with row-gap alone, no
//    column-gap involved) — a real bug in NativeScript's own compiled
//    org.nativescript.widgets.FlexboxLayout widget, not something this
//    adapter can fix. Worse than a no-op, so disabled outright rather
//    than left as an exception in native-tailwind.cjs's property filter.
//    Use margin utilities on individual children for spacing instead.
//  - preflight: Tailwind's HTML/box-sizing reset — meaningless for views
//    that were never HTML elements to begin with.
// This controls generation, not runtime compatibility. The bundled
// @nativescript/tailwind adapter converts units and filters output; our
// wrapper preserves NativeScript 9 properties missing from its filter.
const TAILWIND_CORE_PLUGINS = [
  'margin',
  'padding',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'backgroundColor',
  'borderRadius',
  'borderWidth',
  'borderColor',
  'boxShadow',
  'opacity',
  'textColor',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'fontStyle',
  'textAlign',
  'textDecoration',
  'textTransform',
  'letterSpacing',
  'lineHeight',
  'whiteSpace',
  'textOverflow',
  'visibility',
  'zIndex',
  // FlexboxLayout-scoped (see NFlex.vue) — real CSS properties, but only
  // take effect on an actual <FlexboxLayout>/<NFlex>, same as flexbox only
  // does anything on a real flex container on web.
  'flexDirection',
  'flexWrap',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'justifyContent',
  'alignItems',
  'alignContent',
  'alignSelf'
]

export function tailwindConfig() {
  return `// Generated by \`vastx-native create\`. \`corePlugins\` is deliberately an
// allowlist (not the full Tailwind set) — see the comment above
// TAILWIND_CORE_PLUGINS in vastx-native's own cli/lib/scaffold-templates.mjs
// for exactly which utilities NativeScript's CSS engine can and can't
// apply, and why. Safe to edit, but removing entries here doesn't make
// NativeScript support them — it only controls what Tailwind generates.
module.exports = {
  content: ['./app/**/*.{vue,js,ts}', './.vastx-native/**/*.{js,vue}'],
  darkMode: ['class', '.ns-dark'],
  corePlugins: ${JSON.stringify(TAILWIND_CORE_PLUGINS, null, 2).replace(/\n/g, '\n  ')},
  theme: {
    extend: {}
  }
}
`
}

export function postcssConfig() {
  return `// Tailwind v3 generates utilities; the bundled @nativescript/tailwind
// adapter converts them to native CSS and preserves NativeScript 9 gaps.
// Keep this adapter last. Do not also enable upstream's v4 autoload pipeline.
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('vastx-native/cli/lib/native-tailwind.cjs')()
  ]
}
`
}

export function appCss() {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;
`
}

export function appVue() {
  return `<template>
  <!-- Unused at native runtime: nativescript-vue mounts .vastx-native/root-frame.vue
       (generated by \`vastx-native init\`/\`dev\`/\`build\` from app/pages) instead of
       Nuxt's own client entry. This file only exists so \`nuxi dev\`/typecheck have
       a root component to resolve. -->
  <div />
</template>
`
}

export function nativeIndexPage() {
  return `<template>
  <NPage title="Counter" :scrollable="false">
    <GridLayout rows="*" columns="*">
      <StackLayout verticalAlignment="center" horizontalAlignment="center">
        <NText text="Welcome to VastX Native" :style="{ fontSize: 24, fontWeight: 'bold', textAlignment: 'center', marginBottom: 16 }" />
        <NText :text="String(count)" :style="{ fontSize: 40, textAlignment: 'center', marginBottom: 16 }" />
        <GridLayout columns="*, *" :style="{ marginLeft: 24, marginRight: 24 }">
          <NButton col="0" text="−" variant="secondary" @tap="count--" />
          <NButton col="1" text="+" @tap="count++" />
        </GridLayout>
      </StackLayout>
    </GridLayout>
  </NPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script>
`
}

export function indexPage() {
  return `<template>
  <NPage title="Counter" :scrollable="false">
    <GridLayout rows="*" columns="*">
      <NFlex class="flex-col items-center justify-center p-5">
        <NText text="Welcome to VastX Native" class="text-2xl font-bold text-center mb-4" />
        <NText text="Tap the buttons to change the count." class="text-base text-center mb-4" />
        <NText :text="String(count)" class="text-5xl font-bold text-center" />
      </NFlex>

      <!-- FAB stack: GridLayout lets children share a cell and stack on
           top of each other (later ones drawn on top) — NativeScript has
           no CSS position:fixed, so overlaying a FAB over scrollable/
           centered content means sharing this cell on purpose, not
           assigning row/col. horizontalAlignment/verticalAlignment then
           pin the stack to a corner instead of stretching to fill it. -->
      <NFlex
        class="flex-col items-center"
        horizontalAlignment="right"
        verticalAlignment="bottom"
        :style="{ margin: 24 }"
      >
        <NButton text="+" class="mb-3" :style="fabStyle" @tap="count++" />
        <NButton text="−" variant="secondary" :style="fabStyle" @tap="count--" />
      </NFlex>
    </GridLayout>
  </NPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)

// A circular FAB: NButton's own size prop only controls internal
// padding/font size, so a fixed width/height plus a radius of half that
// turns it into a real circle instead of a pill.
const fabStyle = { width: 56, height: 56, borderRadius: 28, padding: 0 }
</script>
`
}
