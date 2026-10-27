import { loadNuxtConfig } from '@nuxt/kit'

const defaults = {
  appId: 'org.vastxnative.app',
  appName: 'VastXNativeApp',
  platforms: ['ios', 'android'],
  entry: 'app/app.vue',
  styling: 'auto',
  plugins: []
}

/**
 * Reads the `native` key from the project's nuxt.config so the CLI and the
 * Nuxt module agree on appId/appName/entry without duplicating config.
 */
export async function loadNativeConfig(cwd = process.cwd()) {
  const config = await loadNuxtConfig({ cwd })
  return { ...defaults, ...(config.native ?? {}) }
}
