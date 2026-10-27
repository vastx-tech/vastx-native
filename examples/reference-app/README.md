# VastX Native reference app

A small, real (not toy-sized-to-the-point-of-uselessness) shop app —
product list, product detail, a cart backed by Pinia — built to demonstrate
the recommended project architecture for a VastX Native app. Every pattern
here is something the framework actually, verifiably supports; nothing is
aspirational.

Lives inside the framework's own repo, and depends on `vastx-native` via
`"file:../.."` rather than `github:vastx-tech/vastx-native` — so it always
builds against the exact local code in this checkout, not a published
snapshot. A real project outside this repo should depend on it the way
`vastx-native create` generates: a tagged `github:vastx-tech/vastx-native#vX.Y.Z`
spec.

## Folder structure

```
app/
  pages/          file-based routing (see "Routing" below)
  components/     reusable Vue components — NOT auto-imported, import explicitly
  composables/    useXxx() functions — auto-imported, no import statement needed
  utils/          plain helper functions — auto-imported, same as composables/
  stores/         Pinia stores — NOT auto-imported, import explicitly (see why below)
  app.vue         unused at native runtime; exists only so `nuxi dev`/typecheck have a root component
  app.css         Tailwind directives
```

This mirrors Nuxt's own directory conventions on purpose — the goal is that
if you already know how a Nuxt project is organized, you already know how
to organize a VastX Native one. The differences from a web Nuxt project are
exactly the places where "there's no DOM/server, this is a real native
app" changes what's possible, and each one is called out below rather than
left as a surprise.

## Routing

`app/pages/index.vue`, `app/pages/products/[id].vue`, `app/pages/cart.vue`
map to routes `index`, `products_id`, `cart` — the same `index.vue` /
`[param].vue` conventions Nuxt itself uses. There's no `vue-router`/DOM
`history` under the hood (there's no DOM at all) — `useNativeRouter()`
pushes/pops NativeScript's native Frame backstack instead, but you author
pages and navigate between them (`navigate('products_id', { params: { id
} })`) the same way regardless.

## Auto-imports

`useProducts()` (this app's own composable, `app/composables/useProducts.ts`)
and `formatCurrency()` (this app's own util, `app/utils/formatCurrency.ts`)
are both used in these pages/components with **no import statement** —
same as `useNativeRouter()`, `useDevice()`, and every other vastx-native
composable. So is the Pinia store `useCartStore()` from `app/stores/cart.ts`:
every export of every file in `app/composables/`, `app/utils/` and
`app/stores/` is auto-imported by its real name, whatever the file is
called. Add a file there and its exports are usable on the next
`dev`/`build` — no wiring needed.

**Project components** (`ProductCard.vue`, `SectionHeader.vue`) still need
an explicit `import` wherever they're used — component auto-import is a
different mechanism in real Nuxt (component discovery, not the same
`unimport`-style scan), and isn't part of this yet.

## State management

`app/stores/cart.ts` is a plain Pinia setup-store (`defineStore('cart', ()
=> {...})`) — nothing native-specific about it. Its `{ persist: true }` option
saves the cart on the device and restores it when the app starts again
(vastx-native's Pinia plugin, see the framework README's "Saving state on
the device"). Pinia works here because
its actual store engine has no DOM dependency at all (confirmed by
reading its real dist output, see `ARCHITECTURE.md` in the framework repo
for the full verification) — it's wired in automatically by
`generateEntry()` once it detects `pinia` is an installed dependency,
which this app's `package.json` declares.

## Styling

Tailwind utility classes (`flex-col`, `mb-4`, `p-5`, ...) work on
`<NFlex>` and other views — but only the utilities NativeScript's CSS
engine can actually apply are enabled (`tailwind.config.cjs`'s
`corePlugins` allowlist, generated for you, documents exactly which ones
and why). Colors passed as raw values (`color="#64748b"`) rather than
Tailwind classes in a couple of places here (`NText`'s `color` prop) are
deliberate — component-level props, not CSS classes, are how this
framework's own UI kit (`NText`, `NButton`, `NCard`, ...) takes color/
variant input; Tailwind classes are for layout/spacing on raw views.

## Running this app

```
npm install
npx vastx-native init
npx vastx-native dev android   # or ios
```
