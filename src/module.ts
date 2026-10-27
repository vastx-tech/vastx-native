import {
  defineNuxtModule,
  createResolver,
  addImportsDir,
  addComponentsDir,
  addTemplate,
  extendPages
} from '@nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'
import { defu } from 'defu'
import { generateRouteManifest, renderRouteManifestModule } from './build/generate-routes'
import type { VastXNativeOptions } from './types'

export * from './types'

export default defineNuxtModule<VastXNativeOptions>({
  meta: {
    name: 'vastx-native',
    configKey: 'native',
    compatibility: {
      nuxt: '>=3.14.0'
    }
  },
  defaults: {
    appId: 'org.vastxnative.app',
    appName: 'VastXNativeApp',
    platforms: ['ios', 'android'],
    entry: 'app/app.vue',
    styling: 'auto',
    plugins: []
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    if (nuxt.options.ssr) {
      console.warn(
        '[vastx-native] Disabling SSR: native apps render on-device only, there is no server response to hydrate.'
      )
      nuxt.options.ssr = false
    }

    nuxt.options.runtimeConfig.public.native = defu(
      nuxt.options.runtimeConfig.public.native as Record<string, unknown> | undefined,
      { appId: options.appId, appName: options.appName }
    )

    // Composables (useDevice, useSafeArea, useNativeRouter, ...) and
    // components (<NPage>, <NActionBar>, ...) are auto-imported the same
    // way any Nuxt module's are. This covers editor/type-checking DX today;
    // the on-device NativeScript build does not yet share this auto-import
    // step (see ARCHITECTURE.md's status table), so native pages should
    // still import explicitly from "vastx-native" for now.
    addImportsDir(resolver.resolve('./runtime/composables'))
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      prefix: 'N',
      pathPrefix: false
    })

    // Nuxt's page graph is the source of truth for routes, but there is no
    // vue-router/DOM history driving navigation at runtime — the
    // NativeScript Frame stack is. `extendPages` gives us the resolved page
    // tree; we flatten it into a manifest `useNativeRouter()` reads to
    // resolve a route name to a component module.
    //
    // addTemplate() must be called here, synchronously during setup() —
    // Nuxt snapshots its template list before the `pages:extend` hook
    // fires, so registering it *inside* that hook (as opposed to just
    // capturing the page tree there) silently drops it from the build.
    // `getContents` itself only runs later, once Nuxt actually writes
    // templates, by which point `pages:extend` has already populated
    // `latestPages`.
    let latestPages: NuxtPage[] = []
    extendPages((pages) => {
      latestPages = pages
    })

    addTemplate({
      filename: 'vastx-native/route-manifest.mjs',
      write: true,
      getContents: () => renderRouteManifestModule(generateRouteManifest(latestPages))
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolver.resolve('./runtime/types.d.ts') })
    })
  }
})
