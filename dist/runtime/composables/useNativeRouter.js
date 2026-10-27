import { readonly, ref } from "vue";
import { Frame } from "@nativescript/core";
import { $navigateBack, $navigateTo } from "nativescript-vue";
import { routes } from "#build/vastx-native/route-manifest.mjs";
const routeStack = ref([]);
export function useNativeRouter() {
  async function navigate(name, options = {}) {
    const route = findRoute(name);
    const mod = await route.component();
    const component = mod.default ?? mod;
    const page = $navigateTo(component, {
      props: options.params,
      transition: options.transition,
      clearHistory: options.clearHistory,
      backstackVisible: options.backstackVisible,
      animated: options.animated
    });
    routeStack.value = options.clearHistory ? [name] : [...routeStack.value, name];
    return page;
  }
  function back(options) {
    const result = $navigateBack(options);
    routeStack.value = routeStack.value.slice(0, -1);
    return result;
  }
  function canGoBack() {
    return Frame.topmost()?.canGoBack() ?? false;
  }
  return {
    routes,
    navigate,
    back,
    canGoBack,
    /** Stack of route names navigated so far, most recent last. */
    current: readonly(routeStack)
  };
}
function findRoute(name) {
  const route = routes.find((r) => r.name === name);
  if (!route) {
    const known = routes.map((r) => r.name).join(", ");
    throw new Error(`[vastx-native] No route named "${name}". Known routes: ${known}`);
  }
  return route;
}
