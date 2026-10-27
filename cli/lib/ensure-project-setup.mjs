import { join } from 'node:path'
import { ensureTailwindSetup } from './tailwind-setup.mjs'
import { ensureGradleMemorySettings } from './gradle-tuning.mjs'
import { ensureManifestNamespaceFix } from './manifest-namespace-fix.mjs'
import { ensureWebSocketDependency } from './websocket-setup.mjs'
import { ensureNetworkSecurityConfig } from './network-security-setup.mjs'
import { ensureIosInfoPlistKeys } from './ios-infoplist-fix.mjs'
import { ensureAndroidMinSdk, ensureAndroidTheme } from './android-theme.mjs'
import { runPluginSetup } from './plugins.mjs'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Every idempotent native-project patch this framework needs, run on
 * every init/dev/build — not just init. Previously these only ran inside
 * `init()`, which meant a project only stayed correctly configured if
 * someone remembered to rerun `vastx-native init` after adding a
 * dependency (ours or a third-party plugin's) later in the project's
 * life. Every function called here is already safe to call on every
 * single invocation (marker-comment-gated, or a plain existence check —
 * confirmed via real, repeated reruns earlier in this framework's
 * development), so there's no cost to running them unconditionally
 * instead of only once.
 */
export async function ensureProjectSetup(projectRoot, config, platforms) {
  const styling = config.styling ?? 'auto'
  const packagePath = join(projectRoot, 'package.json')
  const packageJson = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')) : {}
  const hasTailwind = existsSync(join(projectRoot, 'tailwind.config.cjs'))
    || existsSync(join(projectRoot, 'tailwind.config.js'))
    || Boolean(packageJson.devDependencies?.tailwindcss || packageJson.dependencies?.tailwindcss)
  if (styling === 'tailwind' || (styling === 'auto' && hasTailwind)) {
    await ensureTailwindSetup(projectRoot)
    console.log('[vastx-native] Tailwind config ready (tailwind.config.cjs/postcss.config.cjs/app/app.css)')
  }

  if (platforms.includes('android')) {
    ensureGradleMemorySettings(join(projectRoot, 'platforms'), platforms)
    console.log('[vastx-native] Tuned Gradle memory settings for this machine')

    ensureManifestNamespaceFix(join(projectRoot, 'platforms'), platforms)

    ensureWebSocketDependency(projectRoot)
    console.log('[vastx-native] Added OkHttp (for useWebSocket()) to App_Resources/Android/app.gradle')

    ensureNetworkSecurityConfig(projectRoot)
    console.log('[vastx-native] Added a debug-only cleartext exception for useWebSocket() dev servers (127.0.0.1/10.0.2.2/localhost)')

    ensureAndroidMinSdk(projectRoot, config.android?.minSdk)

    const skipped = ensureAndroidTheme(projectRoot, config.theme)
    if (config.theme?.background) {
      console.log('[vastx-native] Android theme generated from native.theme (window background, status bar, accent)')
      for (const file of skipped) {
        console.warn(`[vastx-native] Left App_Resources/Android/src/main/res/${file} alone: it's your own file, not one generated from native.theme.`)
      }
    }
  }

  if (platforms.includes('ios')) {
    ensureIosInfoPlistKeys(projectRoot)
    console.log('[vastx-native] Verified App_Resources/iOS/Info.plist has the keys Xcode needs (CFBundleExecutable, ...)')
  }

  await runPluginSetup(projectRoot, config.plugins, platforms)
}
