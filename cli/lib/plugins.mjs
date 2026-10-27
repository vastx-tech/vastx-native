import { createRequire } from 'node:module'
import { join } from 'node:path'

/**
 * Runs native setup for every third-party plugin a project lists in
 * `nuxt.config.ts`'s `native.plugins` array. A "vastx-native plugin" is
 * just an ordinary npm package — nothing here requires our permission or
 * access to this repo. The one convention it can optionally follow: if it
 * needs a native Gradle dependency, an Android permission, an iOS
 * Info.plist entry, etc., it exports a `"./vastx-native"` subpath (its
 * package.json `exports` map needs to declare this — a bare
 * `require.resolve("<name>/vastx-native")` from a consuming project is
 * blocked otherwise, the same exports-map restriction confirmed on this
 * package itself earlier) whose module exports an
 * `ensure(projectRoot, platforms)` function. That function gets called on
 * every init/dev/build, the same as this framework's own
 * `ensureWebSocketDependency`/`ensureNetworkSecurityConfig` — so plugin
 * authors should make it idempotent the same way (a marker-comment guard
 * via `ensureMarkedBlock`, or a plain existence check), since it can run
 * many times over a project's life, not just once.
 *
 * A plugin with no `"./vastx-native"` export at all is left alone — most
 * plugins (anything that's pure JS/TS interop against an already-present
 * native API, or that wraps another already-installed NativeScript
 * plugin needing no extra native config) don't need this step.
 */
export async function runPluginSetup(projectRoot, pluginNames, platforms) {
  for (const name of pluginNames ?? []) {
    await ensurePlugin(projectRoot, name, platforms)
  }
}

async function ensurePlugin(projectRoot, name, platforms) {
  const requireFromProject = createRequire(join(projectRoot, 'package.json'))

  let modulePath
  try {
    modulePath = requireFromProject.resolve(`${name}/vastx-native`)
  } catch {
    return
  }

  const mod = await import(`file://${modulePath.replace(/\\/g, '/')}`)
  if (typeof mod.ensure !== 'function') {
    console.warn(`[vastx-native] Plugin "${name}" has a "./vastx-native" entry but doesn't export ensure(projectRoot, platforms) — skipping.`)
    return
  }

  await mod.ensure(projectRoot, platforms)
  console.log(`[vastx-native] Ran native setup for plugin "${name}"`)
}
