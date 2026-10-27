import { defineNuxtModule, createResolver, addImportsDir, addComponentsDir, extendPages, addTemplate } from '@nuxt/kit';
import { defu } from 'defu';

function generateRouteManifest(pages, parentPath = "") {
  const routes = [];
  for (const page of pages) {
    if (!page.file) continue;
    const path = joinRoutePath(parentPath, page.path);
    const name = routeNameFromPath(path);
    const params = [...path.matchAll(/:(\w+)/g)].map((match) => match[1]);
    routes.push({ name, path, file: page.file, params });
    if (page.children?.length) {
      routes.push(...generateRouteManifest(page.children, path));
    }
  }
  return routes;
}
function renderRouteManifestModule(routes) {
  const entries = routes.map((route) => [
    "  {",
    `    name: ${JSON.stringify(route.name)},`,
    `    path: ${JSON.stringify(route.path)},`,
    `    params: ${JSON.stringify(route.params)},`,
    `    component: () => import(${JSON.stringify(route.file)})`,
    "  }"
  ].join("\n"));
  return `export const routes = [
${entries.join(",\n")}
]
`;
}
function joinRoutePath(parent, child) {
  const joined = `${parent}/${child}`.replace(/\/+/g, "/").replace(/\/$/, "");
  return joined || "/";
}
function routeNameFromPath(path) {
  const slug = path.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return slug || "index";
}

const module$1 = defineNuxtModule({
  meta: {
    name: "vastx-native",
    configKey: "native",
    compatibility: {
      nuxt: ">=3.14.0"
    }
  },
  defaults: {
    appId: "org.vastxnative.app",
    appName: "VastXNativeApp",
    platforms: ["ios", "android"],
    entry: "app/app.vue",
    styling: "auto",
    plugins: []
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);
    if (nuxt.options.ssr) {
      console.warn(
        "[vastx-native] Disabling SSR: native apps render on-device only, there is no server response to hydrate."
      );
      nuxt.options.ssr = false;
    }
    nuxt.options.runtimeConfig.public.native = defu(
      nuxt.options.runtimeConfig.public.native,
      { appId: options.appId, appName: options.appName }
    );
    addImportsDir(resolver.resolve("./runtime/composables"));
    addComponentsDir({
      path: resolver.resolve("./runtime/components"),
      prefix: "N",
      pathPrefix: false
    });
    let latestPages = [];
    extendPages((pages) => {
      latestPages = pages;
    });
    addTemplate({
      filename: "vastx-native/route-manifest.mjs",
      write: true,
      getContents: () => renderRouteManifestModule(generateRouteManifest(latestPages))
    });
    nuxt.hook("prepare:types", ({ references }) => {
      references.push({ path: resolver.resolve("./runtime/types.d.ts") });
    });
  }
});

export { module$1 as default };
