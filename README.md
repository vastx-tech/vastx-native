# VastX Native

**Real native Android and iOS apps, written the Nuxt way.** File-based pages,
auto-imports and Vue single-file components, rendered as genuine native views:
no WebView, no DOM.

[![Release](https://img.shields.io/github/v/release/vastx-tech/vastx-native)](https://github.com/vastx-tech/vastx-native/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**[Docs & landing page](https://native.vastx.in)** ·
**[Quickstart](#quickstart)** ·
**[Changelog](./CHANGELOG.md)**

<!-- SCREENSHOTS -->

```vue
<!-- app/pages/index.vue: this is a real native screen -->
<template>
  <NPage title="Counter">
    <StackLayout :style="{ padding: 24 }">
      <NText :text="`Tapped ${count} times`" variant="h2" :style="{ marginBottom: 16 }" />
      <NButton text="Tap me" @tap="count++" />
    </StackLayout>
  </NPage>
</template>

<script setup lang="ts">
// Auto-imported, and saved on the device between launches
const count = useStorage('count', 0)
</script>
```

```bash
npx vastx-native@latest create my-app --app-id com.example.myapp
cd my-app
npx vastx-native dev android   # or: ios
```

**What you get**

- **Native UI, not a web page.** Vue renders straight to `android.view.View` /
  `UIView`, like React Native, so apps scroll and feel native. Built on
  [NativeScript](https://nativescript.org)'s proven runtime.
- **Nuxt's developer experience.** `app/pages/` routing, auto-imported
  composables, utils and Pinia stores, TypeScript and `vue-tsc` throughout.
- **Batteries included.** A themeable UI kit (`NButton`, `NCard`, `NInput`, ...),
  tabs that stay alive, `useStorage` and persisted Pinia stores, device APIs
  (camera, location, WebSocket), and optional Tailwind.
- **A CLI that does the setup.** `create` gives you a running app, `doctor`
  finds misconfigurations, and `build android --release` signs your APK.

**Status:** early, and moving fast. A developer has built a production Android
app with it, and [2.1.0](./CHANGELOG.md) shipped the fixes they asked for. Android
is tested on real devices; iOS runs on real hardware but has had less testing.
[ARCHITECTURE.md](./ARCHITECTURE.md) records exactly what has been verified and how.

## Why not Capacitor / a WebView?

Capacitor-style tools ship your Nuxt app as compiled web code running inside
a native WebView. That's a fine, fast path to "app-store distributable," but
it isn't native UI — you still get DOM rendering, web-style scrolling, and a
WebView's performance ceiling. VastX Native takes the harder path on purpose:
Vue's renderer targets real native views directly, so the result looks,
scrolls, and performs like a native app because it *is* one — the same
tradeoff React Native and Flutter made, applied to the Nuxt/Vue ecosystem.

## How it fits together

- **`app/pages/`** — you author pages the normal Nuxt way (file-based
  routing, dynamic segments like `[id].vue`).
- **`useNativeRouter()`** replaces vue-router at runtime — there's no DOM
  `history` to push state onto, so navigation pushes/pops NativeScript's
  native Frame backstack instead. Route names still come from your page
  files, so authoring still feels like Nuxt.
- **Composables** (`useDevice`, `useSafeArea`, `useGeolocation`,
  `useCamera`, ...) wrap native device APIs, auto-imported like any Nuxt
  composable.
- **Components** (`<NPage>`, `<NActionBar>`, `<NTabs>`) are thin,
  safe-area-aware wrappers around NativeScript-Vue's native primitives
  (`<Page>`, `<ActionBar>`, ...), plus a tab layout that keeps tabs alive.
- **A UI kit** (`<NButton>`, `<NText>`, `<NInput>`, `<NCard>`, `<NSwitch>`,
  `<NSpinner>`, `<NAvatar>`, `<NBadge>`, `<NDivider>`, `<NFlex>`,
  `<NContainer>`, `<NetworkImage>`, `<CachedImage>`, `<NSkeleton>`,
  `useBottomSheet()`, `useModal()`) — themeable, sensibly-defaulted
  components on top of the primitives above, so building a real screen
  doesn't start from `<StackLayout>` and inline styles every time.
- **Optional Tailwind, scoped to what NativeScript can actually render** —
  `create --styling tailwind` wires up a real `tailwind.config.cjs`/`postcss.config.cjs`/`app.css`, so
  `class="flex-col items-center bg-indigo-600 rounded-lg p-3"` on an
  `<NFlex>` or any UI kit component works the same way it would on web. See
  [UI kit](#ui-kit) below for what's in scope and why.
- **Pinia, as a first-class citizen** — install `pinia` and `vastx-native
  init`/`create` wires `createPinia()` into the app bootstrap automatically.
  See [State management (Pinia)](#state-management-pinia) below.
- **`useMcpClient()`** — apps can connect to [MCP](https://modelcontextprotocol.io)
  servers and call their tools. See [MCP client](#mcp-client-usemcpclient)
  below.
- **`useWebSocket()`** — real native WebSocket support (OkHttp on Android,
  `NSURLSessionWebSocketTask` on iOS), no npm plugin dependency. See
  [Real-time networking](#real-time-networking-usewebsocket) below.
- **Supabase works as-is** for database/auth/storage/edge functions (no
  native code in any of its packages, and NativeScript already provides
  the `fetch` it needs) — Realtime needs one extra adapter. See
  [Third-party backends (Supabase)](#third-party-backends-supabase) below.
- **The `vastx-native` CLI** generates the on-device bootstrap from
  `app/pages` and hands off to NativeScript's own toolchain (`ns run`,
  `ns build`) for the actual native compile/deploy/LiveSync — that's
  battle-tested infrastructure we orchestrate rather than replace. It also
  ships `doctor` (checks a project against every misconfiguration this
  framework has actually hit), `keystore create` (generates an Android
  signing keystore, never touches your passwords), `analyze` (a bundle
  size report), `lint` (catches a `navigate()` call to a route that
  doesn't exist), and `clean`.

## Quickstart

One command, empty directory to a project with dependencies installed and
native platforms wired up:

```bash
npx vastx-native@latest create my-app --app-id com.example.myapp
cd my-app
npx vastx-native dev android   # or: ios
```

`create` scaffolds `nuxt.config.ts` and a starter `app/pages/index.vue`
with a reactive counter and increment/decrement buttons, runs `npm install`,
writes `nativescript.config.ts`, and runs `ns platform add` for each
platform (`--platforms ios,android`, defaults to both) — including
replacing the splash screen NativeScript's own template generates with
VastX Native's own branding, so a fresh install doesn't launch showing
someone else's logo. Verified end-to-end from a clean directory via `npx`;
the only step it can't do for you is provide an actual Android SDK / Xcode
install — `ns platform add` will tell you clearly if either is missing.

### Versions and updating

Each release is published to [npm](https://www.npmjs.com/package/vastx-native)
and tagged on GitHub (`v3.0.0`, ...), with notes on the
[releases page](https://github.com/vastx-tech/vastx-native/releases) and in
[CHANGELOG.md](./CHANGELOG.md). `create` pins new projects to the release that
created them: their package.json gets
`"vastx-native": "github:vastx-tech/vastx-native#v3.0.0"`, so every machine builds
with the same framework code. To update, change the tag and reinstall:

```bash
npm install vastx-native@3.0.0   # or from GitHub: npm install github:vastx-tech/vastx-native#v3.0.0
npx vastx-native init   # re-applies generated config for the new version
```

Check CHANGELOG.md's "Changed" section first; it lists anything that behaves
differently. Installing without a tag (`github:vastx-tech/vastx-native`) follows
`main`, which can change on any merge.

Adding it to an **existing** Nuxt project instead:

```bash
npm install vastx-native nativescript-vue @nativescript/core
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vastx-native'],
  native: {
    appId: 'com.example.myapp',
    appName: 'My App'
  }
})
```

```bash
npx vastx-native init          # scaffolds nativescript.config.ts + native platforms
npx vastx-native dev ios       # build, deploy, and LiveSync to a simulator/device
npx vastx-native dev android
```

Write pages under `app/pages/` using NativeScript-Vue's native elements —
`<Frame>`, `<StackLayout>`, `<Label>`, `<Button>` — instead of HTML.
`<NPage>`, `<NActionBar>`, and `<NTabs>` wrap the common ones with
sensible defaults. See [`playground/`](./playground) for a working example.

`npm run typecheck` (in projects created with `create`) runs `vue-tsc`
against your pages, including the types vastx-native generates for
auto-imports and its `N*` components. In an existing project, add
`vue-tsc` and the same script yourself.

### Coming from `nuxt-native`?

VastX Native was called `nuxt-native` up to v2.2.1. Starting with v3.0.0 it is
published as `vastx-native`. To move an existing app over:

1. Swap the package:

   ```bash
   npm uninstall nuxt-native && npm install vastx-native
   ```

2. In your app, find and replace `nuxt-native` with `vastx-native` in every file
   except `node_modules/` and `platforms/`. The old name is written into more
   places than `nuxt.config.ts`: `nativescript.config.ts` and package.json point at
   the `.nuxt-native/` folder, `tsconfig.json` and `webpack.config.cjs` reference
   it, and the files under `App_Resources/` contain `nuxt-native:` comments that
   mark the blocks the CLI manages. Missing one of those comments leaves the CLI
   adding a duplicate block next to the old one.
3. Do the same for `NuxtNative` → `VastXNative` and `NUXT_NATIVE_` →
   `VASTX_NATIVE_` if you import the options type or set the keystore environment
   variables (also check your CI secrets).
4. Rebuild from scratch:

   ```bash
   npx vastx-native clean
   npx vastx-native init
   ```

   and delete the old `.nuxt-native/` folder.

Your `native: { ... }` options don't change. See the 3.0.0 entry in
[CHANGELOG.md](./CHANGELOG.md) for the complete list of renames.

### Android theme and minimum version

```ts
native: {
  theme: { background: '#0B1020', primary: '#7C5CFF', accent: '#22D3EE' },
  android: { minSdk: 23 }
}
```

- `theme.background` becomes the Android window background and status bar
  colour. Without it, Android's window stays white, and a dark app shows
  a white flash on every page transition. A dark background also switches
  the system theme (dialogs, pickers) to dark; a light one gets dark
  status bar icons. `primary` (toolbar, default: `background`) and
  `accent` (widgets) are optional. The files are generated into
  `App_Resources/Android/src/main/res/values*/` on every build. A file
  there that you wrote yourself is left alone, with a warning. iOS isn't
  affected, and neither are the `N*` components' colours, which still come
  from `vastx-native/runtime/theme`.
- `android.minSdk` defaults to 23 (Android 6.0). NativeScript's own default
  is 21, which current Google Play services and Firebase libraries no
  longer support.

## UI kit

```vue
<template>
  <NPage title="Sign in">
    <StackLayout style="padding: 20">
      <NText text="Welcome back" variant="h1" />
      <NInput v-model="email" label="Email" placeholder="you@example.com" />
      <NInput v-model="password" label="Password" secure :error="error" />
      <NButton text="Sign in" variant="primary" :loading="loading" @tap="signIn" />
      <NButton text="Forgot password?" variant="ghost" @tap="openHelp" />
    </StackLayout>
  </NPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBottomSheet } from 'vastx-native/runtime/composables/useBottomSheet.js'
import HelpSheet from '../components/help-sheet.vue'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { open } = useBottomSheet()

async function signIn() {
  loading.value = true
  // ...
  loading.value = false
}

function openHelp() {
  open(HelpSheet)
}
</script>
```

Every component ships with sensible defaults pulled from a shared
`theme.ts` (colors, spacing, radii, type scale) — pass a `variant`/`size`
prop to restyle, or override individual style props directly, same as any
NativeScript-Vue element. `useBottomSheet()`/`useModal()` show any
component of your own as a bottom sheet or modal via nativescript-vue's
real `$showModal` — your content component can dismiss itself by importing
`$closeModal` from `'nativescript-vue'` directly.

### Container, images, and loading placeholders

```vue
<template>
  <NContainer :padding="'lg'" :background="'surface'" :radius="'md'" :elevated="true">
    <CachedImage :src="product.imageUrl" :width="120" :height="120" :radius="'md'">
      <template #fallback>
        <NSkeleton :width="120" :height="120" radius="md" />
      </template>
    </CachedImage>
  </NContainer>
</template>
```

- **`<NContainer>`** — Flutter's `Container`: a single real child
  (`ContentView`), decorated with the same `box()`/`padding()`/`margin()`/
  `size()` style helpers as props instead of a `:style` object. It
  positions *itself* within its own parent (`align` prop); NativeScript's
  `ContentView` lays a single child out using that child's *own*
  alignment, not something a wrapper can reach in and set — style the
  child directly for that.
- **`<NetworkImage>`** / **`<CachedImage>`** — `<Image src="https://...">`
  (NativeScript's own primitive) already loads remote URLs natively; these
  wrap it with a real loading spinner and a `#fallback` slot for failed
  loads (there's no dedicated error event, so failure is detected by
  "finished loading, no image set" — see `useRemoteImageState.ts`).
  `CachedImage` forces `useCache: true`; `NetworkImage` defaults to
  `false` (always re-fetches). That distinction is genuinely **Android-only**
  — `useCache` doesn't exist on NativeScript's iOS `Image` at all (confirmed
  by reading `index.ios.js`), so both behave the same there.
- **`<NSkeleton>`** — a loading placeholder with a real animated shimmer
  sweep, driven by NativeScript's own `View.animate()` (not CSS
  `@keyframes` — an inline style object has nowhere to hang an
  `animation-name`), looping via the confirmed-real
  `iterations: Number.POSITIVE_INFINITY`, and stopped cleanly on unmount
  via the animation promise's own `.cancel()`.

### Taps that count every tap

On Android, `@tap` on a layout, label or card drops a quick second tap: it goes
through Android's double-tap detection, which treats a tap within about 300 ms of
the previous one as part of a double tap. Use `v-tap` instead of `@tap` on
anything people tap repeatedly:

```vue
<StackLayout v-tap="() => quantity++" class="p-4">
  <Label :text="`Quantity: ${quantity}`" />
</StackLayout>
```

- It uses Android's click listener, like a native `<Button>`, so every tap counts.
  It also adds the standard Android ripple, clipped to the view's rounded
  corners; `v-tap.noripple` leaves the ripple out.
- On iOS it's the same as `@tap`, which already counts every tap there.
- `<NButton>` works this way already.
- Use `v-tap` or `@tap` on an element, not both.
- Taps that navigate (opening a detail page) may be better left on `@tap`: with
  `v-tap`, a quick double tap opens the page twice, as it would with a native
  button.

### Tabs

```vue
<template>
  <NPage :scrollable="false">
    <NTabs v-model="tab" :tabs="tabs">
      <template #explore><ExploreTab /></template>
      <template #saved><SavedTab /></template>
      <template #profile><ProfileTab /></template>
    </NTabs>
  </NPage>
</template>

<script setup lang="ts">
const tab = ref('explore')
const tabs = [
  { name: 'explore', title: 'Explore', icon: 'res://ic_explore' },
  { name: 'saved', title: 'Saved', icon: 'res://ic_saved' },
  { name: 'profile', title: 'Profile', icon: 'res://ic_profile' }
]
</script>
```

Don't switch tabs by navigating between pages. Every navigation builds a
new page, which took 600–800 ms per switch in one real app. `<NTabs>` keeps
every tab alive instead: each tab's content is built the first time it's
opened, then stays attached, and switching only changes which tab is
visible. Scroll position, form input and loaded data are kept.

- Put `<NTabs>` in a page with `:scrollable="false"`, and add a
  `<ScrollView>` inside each tab that needs one.
- On Android, the back button returns to the first tab before leaving the
  page (`:back-to-first="false"` turns this off). It only applies while the
  tabs page is on screen. A detail page opened from a tab with
  `useNativeRouter().navigate()` covers the tabs, and going back returns to
  them unchanged.
- Props: `position` (`'bottom'`, the default, or `'top'`), `lazy`
  (default `true`; `false` builds every tab at startup), and
  `active-color` / `inactive-color` / `bar-color`. The `change` event
  receives `(name, index)`.
- To customise the tab buttons (an `<NSvg>` icon, a badge), use the `tab`
  slot: `<template #tab="{ tab, active }">`.
- It isn't built on NativeScript's `TabView`. On Android with bottom tabs,
  `TabView` rebuilds the native views of any tab more than one position
  from the selected one each time you return to it.

### Tailwind

New projects use native style objects by default. Choose `--styling tailwind`
with `vastx-native create` to enable **Tailwind v3 + the bundled
`@nativescript/tailwind` adapter**. Existing Tailwind projects continue to use
their current setup.
The generated PostCSS config runs the framework's compatibility wrapper after
Tailwind. It converts `1rem` to `16` native DIPs and preserves NativeScript 9
gaps, max dimensions, and text properties omitted by the upstream filter.
The upstream adapter is pinned and installed as a framework dependency; do not
add it directly to the app and activate its separate Tailwind v4 autoloader.

Read [STYLING.md](./STYLING.md) for the spacing contract. New projects receive
that guide plus `AGENTS.md` so coding agents use the same conventions.
`init`, `dev`, and `build` migrate the old untouched generated PostCSS config
with a backup. Custom configurations are preserved with migration instructions.
The corrected units can enlarge spacing in existing screens; review any values
that were inflated to compensate for the old rem bug.

NativeScript's CSS engine only understands a fixed set of properties —
spacing, color, typography, borders/radius, opacity, shadow, visibility,
z-index, and flex properties (but only on a real `<FlexboxLayout>`). It has
no concept of `display`, `position`, `overflow`, or CSS grid at all — those
are NativeScript layout *containers* (`StackLayout`/`FlexboxLayout`/
`GridLayout`/`AbsoluteLayout`), never CSS properties. So `create` generates
a `tailwind.config.cjs` with `corePlugins` as an **allowlist** of only the
utilities that map to something NativeScript can actually render — running
Tailwind's full, unfiltered utility set would just generate a lot of classes
that silently do nothing. It's pinned to Tailwind **v3** specifically,
since v4 dropped the JS-config `corePlugins` API this relies on.

```vue
<template>
  <NPage title="Sign in">
    <NFlex class="flex-col p-5">
      <NText text="Welcome back" variant="h1" align="center" class="mb-4" />
      <NFlex class="flex-row items-center justify-between bg-slate-100 rounded-lg p-3 mb-4">
        <NText text="Remember me" />
        <NSwitch v-model="remember" />
      </NFlex>
      <NButton text="Sign in" size="lg" @tap="signIn" />
    </NFlex>
  </NPage>
</template>
```

`<NFlex>` is a bare `<FlexboxLayout>` wrapper — flex utility classes
(`flex-row`/`flex-col`, `items-*`, `justify-*`) only do anything on one of
these, the same way flex utilities only do anything on a real flex
container on web. **Not supported**: `gap-*` (confirmed on a real Android
device that a non-zero row-gap on a `<FlexboxLayout>` silently drops its
last child from the native view tree entirely — a real bug in
NativeScript's own compiled `org.nativescript.widgets.FlexboxLayout`
widget, disabled framework-wide rather than left as a trap; use a margin
utility on every child but the last instead), `grid-*` (NativeScript's grid
is configured via `columns`/`rows` template strings, not CSS), `absolute`/
`inset-*`/`top-*` (no CSS `position` concept), and Tailwind's `rotate-*`/
`scale-*`/`translate-*`/transform utilities (they compose via CSS custom
properties NativeScript's transform parser doesn't resolve — use the native
`rotate`/`scaleX`/`translateX` style props directly instead). Verified end
to end at the pipeline level (real Tailwind + PostCSS output fed through
the same CSS parser `@nativescript/webpack` uses) — see
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full trail, including why this
ships Android-first with iOS's `<FlexboxLayout>` performance deliberately
left to a real on-device benchmark before it's the default there too.

### Typed style helpers

An alternative to Tailwind classes — Flutter's actual mechanism (widgets
take typed style objects, not a CSS engine), which NativeScript already
supports directly: every `:style` binding is already a plain JS object, not
a CSS string. `vastx-native/runtime/style.js` gives that a small, typed API
built on the same tokens the UI kit uses — no CSS generation or parsing, so
nothing here can hit the "utility isn't supported, so it silently no-ops"
class of bug Tailwind needs a `corePlugins` allowlist to guard against.
Every property is one confirmed real on NativeScript's View/Style classes
(grepped directly from `@nativescript/core`'s own `cssName:` registrations,
not assumed from documentation).

All of these are **auto-imported** — no import statement needed, same as
any composable. Combine them by binding `:style` to an **array** (Vue's own
built-in style-array merging, confirmed supported by nativescript-vue's
renderer):

```vue
<template>
  <NFlex :style="[padding('lg'), bg('surface'), flex({ direction: 'column' })]">
    <Label text="Total" :style="textStyle({ size: 'xl', weight: 'bold', color: 'primary' })" />
    <Label text="Card" :style="[border({ radius: 'md' }), box({ elevated: true })]" />
  </NFlex>
</template>
```

**Lengths** (`padding`, `margin`, `size`, `border`'s width/radius, `textStyle`'s
size/lineHeight) accept a spacing token (`'md'`), a raw number (device-
independent pixels), or a `'16px'`/`'1rem'` string for readability —
`1rem` is a deliberate convention borrowed from CSS (`= 16dip`), not a real
NativeScript unit; it has no root-font-size concept of its own.

| Function | Covers |
|---|---|
| `padding(length \| sides)` / `margin(length \| sides)` | Box model spacing, per-side via `{ top, right, bottom, left, horizontal, vertical, all }` |
| `size({ width, height, minWidth, minHeight, maxWidth, maxHeight })` | Dimensions — `'100%'`/`'auto'` pass through literally |
| `bg(color)` / `bg({ color, image, repeat, position, size })` | Background color, or the full shorthand (`image` supports real `linear-gradient(...)`) |
| `box({ radius, background, elevated, borderColor, borderWidth, opacity, clipPath })` | The common-case container look — single radius/border, optional shadow. NativeScript has no `overflow` property at all; `clipPath` (a real CSS `clip-path` shape string) is the only way to clip content |
| `border({ width, color, radius, cornerShape })` | Per-side width/color, per-corner radius, `'round'`/`'squircle'` corners — reach for this over `box()` when sides need to differ |
| `textStyle({ size, weight, color, align, family, style, decoration, transform, letterSpacing, lineHeight, whiteSpace, overflow, maxLines, shadow, stroke, variationSettings })` | Full text styling — `stroke: { width, color }` is real CSS `text-stroke`; `variationSettings` is a raw `font-variation-settings` string (variable-font axes), iOS-only |
| `flex({ direction, wrap, justify, align, alignContent, gap, rowGap, columnGap, grow, shrink, alignSelf, order, wrapBefore })` | Flex container/item properties — **only takes effect on a real `<NFlex>`/`<FlexboxLayout>`**, same as flexbox only does anything on a flex container on web. `justify` genuinely doesn't support `'space-evenly'` — confirmed directly against NativeScript's flexbox implementation, not a Tailwind-only limitation. `wrapBefore` is a flex-item property that forces a wrap before that item. **Avoid `gap`/`rowGap`/`columnGap`** — confirmed on a real Android device that a non-zero row-gap silently drops a `<FlexboxLayout>`'s last child from the native view tree entirely (same underlying native property Tailwind's `gap-*` sets, which is disabled framework-wide for exactly this reason); use per-child margin for spacing instead |
| `transform({ rotate, rotateX, rotateY, scaleX, scaleY, translateX, translateY, perspective })` | Real, literal-number transforms — works where Tailwind's `rotate-*`/`scale-*` utilities can't (they compose from CSS custom properties NativeScript's parser doesn't resolve) |
| `align({ horizontal, vertical })` | A view's own position *within its parent* (`horizontalAlignment`/`verticalAlignment`) — a different concept from `flex`'s `align-items`, which positions children of a flex container |
| `visible(value)` / `zIndex(value)` | `'visible' \| 'hidden' \| 'collapse'`; stacking order |
| `elevation(value, dynamicOffset?)` | Android-only Material elevation shadow — use `box({ elevated: true })` instead for a cross-platform shadow |
| `direction(value)` | iOS-only `'ltr' \| 'rtl'` |
| `tintColor(color)` | A view's inherited tint color (real `Style`-level property — e.g. `NSwitch`'s on-tint on iOS) |
| `placeholder(color)` | Placeholder text color for `NInput`'s underlying TextField/TextView |
| `opacity(color, amount)` / `shade(color, amount)` / `tint(color, amount)` | Flutter-style color manipulation — `Color.withOpacity()`/`Color.shade*`, real hex/rgb math, `amount` is 0–1 |

## State management (Pinia)

```bash
npm install pinia @vue/devtools-api
npx vastx-native init android   # re-wires the bootstrap now that pinia is present
```

```ts
// app/stores/counter.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  function increment() { count.value++ }
  return { count, increment }
})
```

```vue
<template>
  <NPage title="Home">
    <NFlex class="flex-col p-5">
      <NText :text="`Count: ${counter.count}`" class="mb-4" />
      <NButton text="Increment" @tap="counter.increment" />
    </NFlex>
  </NPage>
</template>

<script setup lang="ts">
const counter = useCounterStore() // auto-imported from app/stores/
</script>
```

`vastx-native init`/`create` detects a `pinia` dependency and wires
`createApp(RootFrame).use(createPinia())` into the generated bootstrap
automatically — nothing else to configure. Stores are plain Pinia,
auto-imported from `app/stores/` the same way composables are (see
Auto-imports below) — no special vastx-native API. This works because Pinia's core is
pure Vue reactivity with no DOM dependency at all (checked directly against
its actual dist output, not assumed), and every DOM/devtools-only code path
it has is gated behind a `typeof window !== 'undefined'` check that's
simply always false in NativeScript's runtime. Verified with a real
`webpack()` compile: a store used from a page compiles cleanly and its
code is confirmed present in the emitted bundle — see ARCHITECTURE.md for
the full verification trail.

Not every Nuxt module works this way — most inject their functionality
through Nuxt's own Vite/Nitro build hooks, which the native build never
runs at all (it's a separate NativeScript webpack pipeline end to end), or
assume a DOM/SSR context that doesn't exist here. Pinia works because its
actual logic has neither dependency; before adding another module, check
whether the same is true for it.

### Saving state on the device

There's no `localStorage` in a native app. Two built-in replacements, both
saved with NativeScript's `ApplicationSettings` (SharedPreferences on
Android, NSUserDefaults on iOS), so they suit settings and small state
rather than large data sets:

```ts
// A ref that's saved on change and restored at startup (auto-imported)
const theme = useStorage('theme', 'system')
const recent = useStorage<string[]>('recent-searches', [])
recent.value.push('tokyo')  // deep changes are saved too
recent.value = undefined    // removes it; the ref goes back to the default
```

```ts
// A whole Pinia store, restored when the app starts
export const useCartStore = defineStore('cart', () => { /* ... */ }, { persist: true })
// or only some of its state, under a key of your choosing
defineStore('auth', { state: () => ({ token: '', draft: '' }), persist: { pick: ['token'], key: 'auth' } })
```

- `useStorage` returns the same ref for the same key everywhere in the app.
- Values are stored as JSON: use plain data. Dates come back as strings,
  and class instances come back as plain objects.
- `persist` is handled by a Pinia plugin that the generated app entry
  registers whenever `pinia` is installed. It only affects stores that set
  `persist`, and the option is typed in the generated
  `.vastx-native/auto-imports.d.ts`.
- Neither is encrypted: don't store secrets you'd keep out of
  SharedPreferences/NSUserDefaults.

## MCP client (`useMcpClient()`)

Apps built with vastx-native can connect to [MCP](https://modelcontextprotocol.io)
servers and call their tools — e.g. building an AI-assistant mobile app.

```vue
<script setup lang="ts">
import { useMcpClient } from 'vastx-native/runtime/composables/useMcpClient.js'

const mcp = useMcpClient()
await mcp.connect('https://your-mcp-server.example.com/mcp')
const tools = await mcp.listTools()
const result = await mcp.callTool('search', { query: 'vastx native' })
</script>
```

This implements MCP's "Streamable HTTP" transport in its non-streaming
mode — the only mode a NativeScript app can actually speak. Confirmed
directly against a real device (not assumed): NativeScript's runtime has
`fetch`/`XMLHttpRequest` but no `WebSocket` and no `EventSource`, which
rules out MCP's stdio/WebSocket transports and the streaming half of
Streamable HTTP (server-initiated messages need `EventSource`-style SSE
parsing). What's left — POST a JSON-RPC message, read an `application/json`
response directly — is fully spec-compliant, confirmed against the real
MCP TypeScript SDK's own client transport as exactly the code path it
falls back to itself against a non-streaming server, not a simplification
invented here. A server that insists on streaming responses gets a clear
error, not a silent hang.

Verified against a real MCP server (`mcp-server/test-http-server.mjs`,
also useful for testing your own MCP-powered pages locally): the full
`initialize` → `notifications/initialized` → `tools/list` → `tools/call`
sequence, session ID correctly captured and echoed, run with plain
`fetch` — the same API surface the device has. Compiles cleanly through
the real native webpack build alongside a real, full-sized app. Not yet
confirmed inside an actual compiled app running on a physical device
against a network-reachable server (needs real network topology this
session didn't have set up) — everything short of that on-device run is
verified.

## Real-time networking (`useWebSocket()`)

```vue
<script setup lang="ts">
import { useWebSocket } from 'vastx-native/runtime/composables/useWebSocket'

const ws = useWebSocket('wss://your-server.example.com/socket', {
  onOpen: () => console.log('connected'),
  onMessage: (data) => console.log('got:', data),
  onClose: (code, reason) => console.log('closed', code, reason)
})
ws.send('hello')
</script>
```

Import this one **without** a `.js` suffix, unlike every other composable —
see the composable's own doc comment for exactly why (it's a real,
confirmed resolution-order interaction between this package's `exports`
field and webpack's platform-extension list, not an arbitrary choice).

NativeScript has no global `WebSocket` (confirmed on a real device: `typeof
WebSocket` is `"undefined"`), and no maintained NativeScript WebSocket
plugin exists on npm (checked directly). This talks to each platform's
real native WebSocket capability directly instead: Android via OkHttp
(added as a real Gradle dependency automatically by `vastx-native init`,
since `@nativescript/core`'s own HTTP module uses its own native widget,
not OkHttp — confirmed by reading its Android implementation), iOS via
`NSURLSessionWebSocketTask` (a first-party OS API since iOS 13, no extra
dependency needed). The Java/Objective-C interop patterns used
(`SomeClass.extend({...})` to subclass a native class from JS) are
confirmed as NativeScript's real, standard convention by reading three
independent usages in `@nativescript/core`'s own source before writing
this, not invented.

**Verification status, honestly**: the Android implementation is fully
verified on real hardware — real webpack build, real `gradlew.bat
assembleDebug`, real `adb install` onto a physically connected device, a
real Node.js WebSocket server bridged over USB via `adb reverse`. On
launch the app logged a real `open` event and the server's own greeting
message, received live; tapping a real on-screen button sent a real
message that the server logged and echoed back, and the device logged the
echo. Two real bugs were only caught this way, not by compiling: OkHttp
5.x's split `okhttp-android` artifact needs `compileSdk` 37+ (this
project defaults to 35), fixed by pinning to OkHttp 4.12.0; and Android
blocks cleartext (`ws://`) traffic by default for apps targeting API 28+,
fixed with a debug-only network security config permitting cleartext to
`127.0.0.1`/`10.0.2.2`/`localhost` (`vastx-native init` wires this up
automatically, same as the OkHttp dependency — see `ARCHITECTURE.md` for
the full detail). Production apps should use `wss://` regardless; the
cleartext exception only applies to debug builds. The iOS implementation
is a real, best-effort implementation against Apple's documented
`NSURLSessionWebSocketTask` API, reviewed the same way the Android one
was, but not yet compiled or run on a device — unlike the iOS work
covered in [ARCHITECTURE.md](./ARCHITECTURE.md) (install/launch/layout/
gestures), this specific composable hasn't been part of a real-device
pass yet.

## Third-party backends (Supabase)

`@supabase/supabase-js` and its sub-packages (auth/postgrest/storage/
functions) are plain JS/TS — no native Android/iOS code at all (checked
directly: none of its five sub-packages ship a `platforms/`, `.gradle`, or
`.podspec`), so there's no linking step, just:

```bash
npm install @supabase/supabase-js
```

Database queries, auth, storage, and edge functions work as-is: every one
of them falls back to a bare `fetch(...)` call if not overridden (confirmed
by reading each package's own `resolveFetch`), and NativeScript's own
`@nativescript/core/globals` already installs a real `global.fetch`/
`Headers`/`Request`/`Response` — no `cross-fetch`/polyfill needed. The
auth client's session storage falls back to in-memory (it correctly
detects there's no `window`/`localStorage`, doesn't crash) unless you give
it a real one — back it with `@nativescript/core`'s sync
`application-settings` module so a session survives an app restart:

```ts
// app/composables/useSupabase.ts
import { createClient } from '@supabase/supabase-js'
import { getString, setString, remove } from '@nativescript/core/application-settings'

const nativeStorage = {
  getItem: (key: string) => getString(key, ''),
  setItem: (key: string, value: string) => setString(key, value),
  removeItem: (key: string) => remove(key)
}

// The URL/anon key are meant to be embedded in a client — Supabase's own
// model protects data via Row Level Security, not by hiding this key.
// Never put a service_role key here; there is no server in this app to
// keep it secret from.
export const supabase = createClient(
  'https://YOUR-PROJECT.supabase.co',
  'YOUR-ANON-KEY',
  { auth: { storage: nativeStorage } }
)
```

**Realtime (`supabase.channel(...)`) needs one more piece.**
`@supabase/realtime-js` requires a global `WebSocket` constructor and
throws `"WebSocket not available"` without one — NativeScript has no
global `WebSocket`, only this framework's own `useWebSocket()` composable
(a different API shape). It accepts a custom `options.transport`, though,
so this is solvable with a small adapter class wrapping `useWebSocket()`'s
native mechanism in the standard `WebSocket` interface shape
(`onopen`/`onmessage`/`onclose`/`onerror`/`send()`/`close()`/`readyState`)
— not shipped yet, since no project has needed it yet.

## Performance

Two different problems — compile speed and runtime FPS — with different
levers:

- **Lists**: a plain `v-for` over `NCard`/`NFlex` keeps every item as a
  live, permanent native view forever. `<ListView>` (real, confirmed view
  recycling — `recycleNativeView: 'auto'`, backed by Android's
  RecyclerView / iOS's `UITableView` cell reuse) is the single biggest
  lever for scroll smoothness once a list goes past ~20–30 items.
- **Image decode size**: an `<Image>` with no `decode-width`/
  `decode-height` fully decodes the source resolution into memory even
  when displayed much smaller — real, confirmed properties on `ImageBase`
  that cap decode resolution to what's actually rendered. Matters most on
  image-heavy scrolling lists.
- **Animations should be native, not JS-driven**: `NSkeleton`'s shimmer
  uses `View.animate()`, which hands the animation off to the platform's
  own compositor (Android `ValueAnimator`/iOS `CAAnimation`) instead of a
  JS per-frame loop — this is what lets it track a 120Hz display for free
  rather than being capped by JS thread timing. Prefer `View.animate()`
  over a reactive `:style` mutated on an interval for anything continuous.
- **Layout nesting depth**: NativeScript's layout is a real native
  measure/layout pass per nesting level — flattening deeply nested
  `NFlex`-in-`NFlex`-in-`NCard` chains into `GridLayout` cells reduces
  layout-pass cost on every scroll frame.
- **Build speed**: `ts-loader` already runs with `transpileOnly: true`
  and a memory-tuned `ForkTsCheckerWebpackPlugin` (see below). Adding
  `cache: { type: 'filesystem' }` to a project's `webpack.config.cjs` is
  the next real win for incremental `dev` rebuilds — webpack's own
  persistent disk cache skips re-parsing unchanged modules entirely.

## Gradle memory tuning

`vastx-native init` also patches `platforms/android/gradle.properties` once,
right after `ns platform add` scaffolds it: the stock `@nativescript/android`
template ships `org.gradle.jvmargs=-Xmx16384M` — a flat 16 GB Gradle daemon
heap ceiling, regardless of the machine actually running the build. On a
real machine with 5.74 GB of *total* RAM, that's a heap ceiling triple the
entire machine's physical memory, and a very plausible cause of otherwise
mysterious build flakiness (Windows can fail to spawn new processes under
severe memory pressure).

The replacement is computed from the machine's actual total RAM (25% of
it, clamped to 768 MB–2 GB — there's no real benefit to a NativeScript
app's build ever exceeding ~2 GB of daemon heap), plus `kotlin.daemon.jvmargs`
and `org.gradle.workers.max=2` to cap the other JVMs Gradle spins up. It's
written once (marked with a comment so reruns don't clobber a value you've
since customized yourself) and never touches the file again after that.
Verified with a real, full clean rebuild after applying it — succeeded
identically with a fraction of the memory.

The limit used to be 35% / 3 GB, which still crashed an 8 GB Windows
machine. Projects tuned before that keep their old value: edit
`org.gradle.jvmargs` in `platforms/android/gradle.properties`, or delete the
`# vastx-native: memory settings tuned` line there and the next build re-tunes
it.

The generated `webpack.config.cjs` gets the same treatment for
`ForkTsCheckerWebpackPlugin` (a separate Node process `@nativescript/webpack`
spawns just for type-checking, defaulting to a flat 4 GB memory limit): on a
machine with less than 8 GB of RAM it's removed entirely (the main build
already runs `ts-loader` with `transpileOnly: true`, so nothing about the
actual compile depends on it — you still get type errors from your editor
or a `vue-tsc`/`tsc` run), and above that threshold its memory limit is
scaled to the machine instead of left at the flat default.

## Auto-imports

Composables — both vastx-native's own (`useDevice`, `useWebSocket`, ...) and
anything you add yourself under `app/composables/` — are usable in any page
or component with no `import` statement, the same DX Nuxt itself gives you
for its own build:

```vue
<script setup lang="ts">
const device = useDevice()
const { connected } = useWebSocket('wss://your-server.example.com/socket')
</script>
```

This isn't Nuxt's own `unimport`/auto-import machinery running under the
hood (that package is ESM-only, and the native build's `webpack.config.cjs`
is loaded with a plain synchronous `require()` that can't consume it) — it's
a small first-party webpack loader that does the same thing using Vue's own
compiler: it finds the names a file's script and template actually
reference, skips anything the file already imports, declares, or receives
as a prop, and injects the right import into `<script setup>`. Regenerated
automatically on every `init`/`dev`/`build`, so a file you add to
`app/composables/` or `app/utils/` is picked up on the very next run.

What gets auto-imported, and how names are resolved:

- Every value export of every file in `app/composables/`, `app/utils/` and
  `app/stores/` (Pinia stores, as with `@pinia/nuxt`),
  read from the file itself — a `motion.ts` exporting `fadeIn` and
  `slideUp` gives you both, and the filename doesn't matter. A default
  export is available under the file's name. Type-only exports and
  `export * from` re-exports are not included.
- Names used only in `<template>` work too, at runtime and in
  `vue-tsc`/your editor.
- **Your component's own names always win.** A prop, local variable or
  import named `size`, `placeholder`, `padding`, etc. is never replaced by
  the auto-imported helper of the same name. If your `<script setup>` calls
  a helper that a prop of the same component also names, the build fails
  with a message asking you to import it explicitly under another name,
  rather than guessing which one you meant.
- Only composables/utils are covered, not your own custom `.vue`
  components — those still need a normal explicit import (auto-importing
  components is a different mechanism in real Nuxt, not this one).
- A component without `<script setup>` can't receive template-only
  auto-imports (a plain `<script>` block's imports aren't visible to its
  template); the build warns when that happens.

## Plugins

A "vastx-native plugin" is just an ordinary npm package that exports one or
more `useXxx()` composables — install it like anything else. If it needs
native setup (a Gradle dependency, an Android permission, an iOS
`Info.plist` entry, ...), list it in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  native: {
    plugins: ['some-vastx-native-plugin']
  }
})
```

`vastx-native init`/`dev`/`build` will then look for a `"./vastx-native"`
subpath export on that package (it needs to declare this in its own
`package.json`'s `exports` map) and, if present, call its
`ensure(projectRoot, platforms)` function — the same idempotent pattern
this framework uses for its own native setup (OkHttp for `useWebSocket()`,
the cleartext network exception, etc.), so it's safe to run on every
build, not just the first one. A plugin with no such export is left alone
— most plugins (anything that's pure JS/TS interop, or that wraps an
already-installed NativeScript plugin needing no extra native config)
don't need one.

## CLI reference

```bash
vastx-native create <name> [--app-id com.example.app] [--platforms ios,android] [--styling native|tailwind] [--link /path/to/vastx-native]
vastx-native init [ios] [android]     # add to an existing project
vastx-native dev <ios|android> [ns run flags...]
vastx-native build <ios|android> [ns build flags...]
vastx-native doctor                   # check the project, then run `ns info`
vastx-native keystore create --alias <name> [--output ./release.keystore]
vastx-native analyze <ios|android>    # bundle size report → report/report.html
vastx-native lint                     # catch a navigate() call to a route that doesn't exist
vastx-native clean                    # remove platforms/, hooks/, and cached build artifacts
vastx-native version [show]           # show the current version + versionCode
vastx-native version bump <major|minor|patch>
vastx-native version sync             # write the current version to native platform files
```

`dev`/`build` forward any flags after `<ios|android>` straight to the real
`ns run`/`ns build` — nothing NativeScript supports is off-limits. For a
signed Android release, generate a keystore once and set the environment
variables it prints (never written to disk):

```bash
npx vastx-native keystore create --alias my-app
# then, once VASTX_NATIVE_KEYSTORE_* is set in your shell/CI secrets:
npx vastx-native build android --release
```

`--link` points the generated project's `vastx-native` dependency at a local
checkout (a `file:` spec — npm symlinks it, no network fetch) instead of
`github:vastx-tech/vastx-native`. Both paths use the prebuilt `dist` committed
with the framework, so installing an app does not compile the framework:

```bash
vastx-native create myapp --link ../vastx-native
```

## App release versioning

`package.json`'s own `version` field (standard semver) is the single
source of truth, plus a `nativeVersionCode` field for Android's separate
integer build number (Play Store requires it to only ever increase, which
a semver string alone can't express — e.g. two releases can share a
patch-bumped version but still need distinct versionCodes).

```bash
npx vastx-native version              # show the current version + versionCode
npx vastx-native version bump patch   # 1.0.0 (1) -> 1.0.1 (2), synced automatically
npx vastx-native version sync         # re-sync current values without bumping
```

`bump`/`sync` write `android.defaultConfig.versionCode`/`versionName` into
`App_Resources/Android/app.gradle` (a real Gradle `apply from:` include
NativeScript's own build already supports — confirmed, not guessed) rather
than editing the manifest directly, since `platforms/android/app/src/main/
AndroidManifest.xml` gets regenerated from `@nativescript/android`'s own
template on every `ns platform add` and wouldn't survive. AGP's
`defaultConfig` always wins over the manifest's own `android:versionCode`/
`versionName` attributes, so this is the standard, sanctioned override
mechanism, not a workaround. Only touches `App_Resources/iOS/Info.plist`
if that platform was actually added. Idempotent via a marked block, so a
project's own `app.gradle` customizations outside it are never touched.
Verified end to end: a real `bump patch` → real `gradlew.bat assembleDebug`
→ `aapt dump badging` on the resulting APK confirmed `versionCode='2'
versionName='1.0.1'` actually landed in the compiled app, not just the
source files.

## VS Code extension

`vscode-extension/` (not yet published to the Marketplace — see its own
README) puts every command above in the Command Palette, plus a device
picker and hot-restart/force-restart/stop controls on the status bar. It
runs everything inside a real integrated terminal rather than a background
process, specifically because `ns run`'s interactive controls only work
over a real TTY (confirmed by reading NativeScript's own source, not
assumed) — click into that terminal at any point and the same keys work
by hand too.

## MCP server (agent-driven dev workflow)

Install optional MCP dependencies with `npm install -D @modelcontextprotocol/sdk zod`,
then run `npx vastx-native mcp` from an app project to start the bundled stdio
MCP server. Configure your AI agent to launch that command; no separate
repository clone or server folder is needed. New projects include setup
instructions in their README. See [MCP setup](./mcp-server/README.md) for
agent configuration, including Windows launch options.

The server exposes `vastx-native`'s dev workflow —
`doctor`, `build`, `lint`, `clean`, `analyze`, device listing, install +
launch, log reading — as [MCP](https://modelcontextprotocol.io) tools, so
any MCP-speaking AI agent (Claude Code, Claude Desktop, anything else that
speaks MCP) can drive a project directly instead of shelling out blind.
Every tool calls the same `cli/commands/*.mjs` functions the real CLI
uses — there's no separate implementation to drift out of sync. Verified
end to end with a real MCP client driving the real server over the real
stdio transport, including a real install + launch + logcat read against
a physical Android device.

## Repository layout

```
src/                the Nuxt module (composables, components, route generation)
cli/, bin/          the vastx-native CLI (native bootstrap + ns run/build orchestration)
playground/         example Nuxt app consuming the module
vscode-extension/   the VS Code extension (separate package.json/build)
mcp-server/         bundled MCP server exposing the dev workflow to AI agents
```

## Contributing

This is a young project tackling a genuinely hard problem — read
[ARCHITECTURE.md](./ARCHITECTURE.md) first to see the current state and
where help is most valuable, then open an issue or PR.

## License

[MIT](./LICENSE)

VastX Native is an independent project built on Nuxt, Vue and NativeScript. It
is not affiliated with or endorsed by NuxtLabs or the Nuxt team.
