import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { WEBPACK_CONFIG_FILENAME } from './webpack-config.mjs'
import { ENTRY_FILE } from './generate-entry.mjs'

/**
 * Writes nativescript.config.ts if the project doesn't have one yet. This
 * is the file the NativeScript CLI (`ns`) reads to know the appId and where
 * the native-buildable source lives (`appPath`) — App_Resources itself is
 * intentionally NOT hand-generated here: `ns platform add <platform>`
 * scaffolds a correct, version-matched App_Resources tree from NativeScript's
 * own template the first time it runs against this config, which is far
 * more reliable than us hand-authoring AndroidManifest.xml/Info.plist.
 *
 * Points `ns` at webpack.config.cjs instead of its default
 * `webpack.config.js` — see webpack-config.mjs for why the `.cjs` extension
 * is required in a `"type": "module"` project. Set via BOTH
 * `bundlerConfigPath` (the current field) and `webpackConfigPath` (the
 * older field `bundlerConfigPath` itself falls back to when unset) —
 * observed a real project where `ns` used the hardcoded default
 * `webpack.config.js` despite `bundlerConfigPath` being present and
 * correctly parsed in isolation, root cause not yet pinned down. Setting
 * both is a safe, independent-path belt-and-suspenders fix regardless of
 * which one that CLI actually reads.
 *
 * `main` tells @nativescript/webpack's getEntryPath() where the bootstrap
 * entry is — it resolves this *relative to process.cwd() (the project
 * root), not appPath* (confirmed by reading getProjectRootPath(), which is
 * a plain `process.cwd()`). Without it, getEntryPath() falls through to
 * package.json's `main` field; with neither set, it calls
 * `path.resolve(root, undefined)`, which throws ERR_INVALID_ARG_TYPE —
 * reproduced by a real user hitting exactly that crash.
 */
export function ensureNativeScriptConfig(projectRoot, { appId }) {
  const configPath = join(projectRoot, 'nativescript.config.ts')
  if (existsSync(configPath)) return configPath

  writeFileSync(configPath, `import type { NativeScriptConfig } from '@nativescript/core'

export default {
  id: ${JSON.stringify(appId)},
  appPath: '.vastx-native',
  appResourcesPath: 'App_Resources',
  main: ${JSON.stringify(ENTRY_FILE)},
  bundlerConfigPath: ${JSON.stringify(WEBPACK_CONFIG_FILENAME)},
  webpackConfigPath: ${JSON.stringify(WEBPACK_CONFIG_FILENAME)},
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  }
} satisfies NativeScriptConfig
`)

  return configPath
}
