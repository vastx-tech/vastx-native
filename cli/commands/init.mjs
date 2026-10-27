import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadNativeConfig } from '../lib/load-config.mjs'
import { ensureNativeScriptConfig } from '../lib/nativescript-config.mjs'
import { ensureWebpackConfig } from '../lib/webpack-config.mjs'
import { generateEntry } from '../lib/generate-entry.mjs'
import { applySplashBranding } from '../lib/splash.mjs'
import { ensureProjectSetup } from '../lib/ensure-project-setup.mjs'
import { run } from '../lib/run.mjs'

export async function init({ platforms } = {}) {
  const config = await loadNativeConfig()
  const targets = platforms?.length ? platforms : config.platforms

  const configPath = ensureNativeScriptConfig(process.cwd(), config)
  console.log(`[vastx-native] nativescript.config.ts ready at ${configPath}`)

  const webpackConfigPath = ensureWebpackConfig(process.cwd(), config.appId)
  console.log(`[vastx-native] webpack config ready at ${webpackConfigPath}`)

  generateEntry({ pagesDir: 'app/pages' })
  console.log('[vastx-native] Generated .vastx-native/ bootstrap from app/pages')

  for (const platform of targets) {
    // `ns platform add` exits non-zero when the platform is already added
    // (reproduced directly: a real project where `platform add android` had
    // already been run once — rerunning it printed "Platform android
    // already added" and still exited with code 127) — run()'s exit-code
    // check can't tell that apart from a real failure, so it would abort
    // init() here every time, before ever reaching applySplashBranding()
    // below. `vastx-native init` is supposed to be safe to rerun on a
    // project in any state, so check for the platform's own directory
    // first instead of relying on the CLI's exit code for this case.
    if (existsSync(join(process.cwd(), 'platforms', platform))) {
      console.log(`[vastx-native] platforms/${platform} already exists, skipping ns platform add`)
      continue
    }
    console.log(`[vastx-native] ns platform add ${platform} (scaffolds App_Resources on first run)`)
    await run('npx', ['--yes', 'nativescript', 'platform', 'add', platform])
  }

  // Runs after `ns platform add` unconditionally, not just on first init:
  // it's cheap, idempotent (always regenerates the same images), and
  // covers the case where App_Resources already existed (so the platform
  // loop above was a no-op) but was never branded yet.
  applySplashBranding(join(process.cwd(), 'App_Resources'), targets)
  console.log('[vastx-native] Applied VastX Native splash screen branding')

  // Everything below is safe to call on every init/dev/build, not just a
  // project's first init — see ensure-project-setup.mjs. Called here too
  // (not only from dev/build) so `vastx-native init` alone still leaves a
  // project fully configured, matching its documented behavior before
  // this was factored out.
  await ensureProjectSetup(process.cwd(), config, targets)

  console.log('[vastx-native] Init complete. Next: vastx-native dev <ios|android>')
}
