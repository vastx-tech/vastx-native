import { readonly, ref } from 'vue'
import { Frame } from '@nativescript/core'
import { $navigateBack, $navigateTo } from 'nativescript-vue'
import { routes } from '#build/vastx-native/route-manifest.mjs'
import type { NativeRoute } from '#build/vastx-native/route-manifest.mjs'

// nativescript-vue exports the `$navigateBack`/`$navigateTo` functions from
// its package root, but not their option types (only reachable via its
// internal dist/plugins/navigation path) — derived here instead of
// importing a path that isn't part of its public API.
type NavigateBackOptions = NonNullable<Parameters<typeof $navigateBack>[0]>

export interface NavigateOptions {
  /** Passed through as the page's navigation context / component props. */
  params?: Record<string, unknown>
  transition?: { name?: string, duration?: number, curve?: unknown }
  clearHistory?: boolean
  backstackVisible?: boolean
  animated?: boolean
}

// Module-level: one native Frame backstack per running app, so the "current
// route" stack is shared across every component that calls useNativeRouter().
const routeStack = ref<string[]>([])

/**
 * Replaces vue-router for native builds: there is no DOM `history` to push
 * state onto, so navigation instead pushes/pops NativeScript's native Frame
 * backstack via nativescript-vue's $navigateTo/$navigateBack. Route names
 * come from the manifest generated from `app/pages` (see
 * src/build/generate-routes.ts) so page authoring still feels like Nuxt
 * file-based routing, even though nothing here touches vue-router.
 */
export function useNativeRouter() {
  async function navigate(name: string, options: NavigateOptions = {}) {
    const route = findRoute(name)
    const mod = await route.component()
    const component = (mod as { default?: unknown }).default ?? mod

    const page = $navigateTo(component as Parameters<typeof $navigateTo>[0], {
      props: options.params,
      transition: options.transition,
      clearHistory: options.clearHistory,
      backstackVisible: options.backstackVisible,
      animated: options.animated
    })

    routeStack.value = options.clearHistory ? [name] : [...routeStack.value, name]
    return page
  }

  function back(options?: NavigateBackOptions) {
    const result = $navigateBack(options)
    routeStack.value = routeStack.value.slice(0, -1)
    return result
  }

  function canGoBack() {
    return Frame.topmost()?.canGoBack() ?? false
  }

  return {
    routes: routes as NativeRoute[],
    navigate,
    back,
    canGoBack,
    /** Stack of route names navigated so far, most recent last. */
    current: readonly(routeStack)
  }
}

function findRoute(name: string): NativeRoute {
  const route = (routes as NativeRoute[]).find(r => r.name === name)
  if (!route) {
    const known = (routes as NativeRoute[]).map(r => r.name).join(', ')
    throw new Error(`[vastx-native] No route named "${name}". Known routes: ${known}`)
  }
  return route
}
