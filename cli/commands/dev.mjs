import { generateEntry } from '../lib/generate-entry.mjs'
import { loadNativeConfig } from '../lib/load-config.mjs'
import { ensureProjectSetup } from '../lib/ensure-project-setup.mjs'
import { run } from '../lib/run.mjs'
import { stopGradleDaemonIfLowMemory } from '../lib/gradle-tuning.mjs'

/**
 * `nsArgs` is forwarded verbatim to `ns run` — e.g. `--device <id>`,
 * `--emulator`, `--release`. See build.mjs's comment on why this is a
 * pass-through rather than a reimplemented/whitelisted flag set.
 */
export async function dev(platform, nsArgs = []) {
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error('[vastx-native] Usage: vastx-native dev <ios|android> [ns run flags...]')
  }

  generateEntry({ pagesDir: 'app/pages' })

  // Same idempotent setup init() runs, called again here: a project stays
  // correctly configured (Gradle tuning, WebSocket's OkHttp dependency,
  // any third-party plugin's native setup, ...) even if a plugin was
  // added after the last `vastx-native init`, without needing to remember
  // to rerun it by hand. See ensure-project-setup.mjs.
  const config = await loadNativeConfig()
  await ensureProjectSetup(process.cwd(), config, [platform])

  console.log(`[vastx-native] Bootstrap regenerated. Handing off to NativeScript's LiveSync (ns run ${platform})...`)

  // `ns run` builds, deploys to the connected device/simulator, and
  // LiveSyncs subsequent file changes — that hot-reload-to-device loop is
  // NativeScript's, not reimplemented here.
  // `ns run` usually ends with Ctrl+C, which would exit this process before
  // a `finally` runs — so the daemon is also stopped from a SIGINT handler
  // (once, whichever happens first).
  let stopped = platform !== 'android'
  const stopDaemon = () => {
    if (stopped) return
    stopped = true
    stopGradleDaemonIfLowMemory(process.cwd(), config.android?.stopGradleDaemon)
  }
  const onInterrupt = () => {
    stopDaemon()
    process.exit(130)
  }
  process.once('SIGINT', onInterrupt)
  try {
    await run('npx', ['--yes', 'nativescript', 'run', platform, ...nsArgs])
  } finally {
    process.off('SIGINT', onInterrupt)
    stopDaemon()
  }
}
