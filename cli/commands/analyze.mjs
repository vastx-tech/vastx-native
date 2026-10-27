import { generateEntry } from '../lib/generate-entry.mjs'
import { run } from '../lib/run.mjs'
import { loadNativeConfig } from '../lib/load-config.mjs'
import { stopGradleDaemonIfLowMemory } from '../lib/gradle-tuning.mjs'

/**
 * `@nativescript/webpack` already ships webpack-bundle-analyzer support
 * via `--env.report` (confirmed by reading its base config directly) —
 * this just gives that a memorable, discoverable command name instead of
 * requiring users to know that flag exists.
 */
export async function analyze(platform) {
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error('[vastx-native] Usage: vastx-native analyze <ios|android>')
  }

  generateEntry({ pagesDir: 'app/pages' })

  console.log(`[vastx-native] Building ${platform} with a bundle report ...`)
  try {
    await run('npx', ['--yes', 'nativescript', 'build', platform, '--env.report'])
  } finally {
    if (platform === 'android') stopGradleDaemonIfLowMemory(process.cwd(), (await loadNativeConfig()).android?.stopGradleDaemon)
  }

  console.log(`
[vastx-native] Report written to:
  report/report.html   (open in a browser — an interactive treemap of what's in your bundle)
  report/stats.json    (raw webpack stats, for feeding into other tooling)
`)
}
