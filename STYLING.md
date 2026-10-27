# Styling a VastX Native app

This is a native UI, not a browser. Use Tailwind v3 for supported static styles,
component props for built-in variants, and numeric native styles for dynamic values.
The framework bundles @nativescript/tailwind with compatibility for NativeScript 9
max-size and text properties. Do not install a second adapter in this app.

`gap`/`gap-*` is disabled on purpose (not generated, not passed through) — confirmed
on a real Android device that a non-zero row-gap on a `<FlexboxLayout>`/`<NFlex>`
silently drops its last child from the native view tree entirely, a real bug in
NativeScript's own compiled `org.nativescript.widgets.FlexboxLayout` widget. Use
margin utilities on individual children for spacing between flex siblings instead.

## One spacing convention

Tailwind rem lengths compile to device-independent pixels (DIPs): 1rem = 16 DIP.
Use p-4 for 16 DIP of padding, mb-3 for 12 DIP between children, and p-5 for 20 DIP.
Numeric native styles use DIPs: :style="{ padding: 16 }" matches p-4.
Native CSS px units are physical pixels, so prefer unitless numbers in custom CSS.
Typed helpers use their own documented token scale; prefer numeric arguments when
matching utilities (padding(16)). Their px strings currently mean DIPs, unlike CSS px.
Avoid em, viewport units, and browser layout expressions such as calc() for spacing.

## Layout and spacing ownership

- NPage manages safe areas. Place one content layout inside it; add page padding there.
- NFlex is a native FlexboxLayout. Set flex-col or flex-row explicitly.
- Space flex children with a margin utility (mb-4 in a column, mr-4 in a row) on every
  child but the last — not gap-* (disabled, see above).
- GridLayout uses rows/columns and row/col attributes. Unassigned children can overlap.
- A ScrollView has one layout child. Avoid h-full/flex-1 to size the scrolling axis.
- NButton size and NCard padding control their internal inline styles. Do not expect
  Tailwind classes to override those defaults. Put external spacing on a wrapper.
- Native Button widgets have platform-specific padding/minimum sizes. For consistent
  component sizing, use NButton with its size prop.

## Example

```vue
<NPage title="Example">
  <NFlex class="flex-col p-5">
    <Label text="Hello" class="text-2xl font-bold mb-4" />
    <Label text="Native spacing, familiar classes." textWrap="true" class="text-base mb-4" />
    <NButton text="Continue" size="md" />
  </NFlex>
</NPage>
```

## Supported styles

Use the generated Tailwind corePlugins allowlist. Browser display/grid/position,
space-*, ring-*, transform utilities, hover, and responsive breakpoint variants are
not part of this default contract. Use native layouts and native transform props.
Keep complete class names in source: use count > 0 ? 'text-green-600' : 'text-red-600',
not 'text-' + color + '-600'. Our content scan includes app Vue, JS, and TS files.
Dark mode uses NativeScript's .ns-dark class.

Native CSS remains available in app/app.css and Vue style blocks. Prefer unitless
DIP lengths. Custom properties supported by NativeScript may still be filtered by
the adapter; use a supported inline native style for properties outside its contract.

## Build and existing projects

Keep Tailwind on v3. postcss.config.cjs runs Tailwind then
require('vastx-native/cli/lib/native-tailwind.cjs')(). This wrapper runs the official
adapter exactly once, after generation. The adapter is a framework dependency,
so NativeScript does not auto-discover its separate Tailwind v4 Webpack pipeline.
If the app already directly depends on @nativescript/tailwind, remove that direct
dependency or explicitly set tailwind: { autoload: false } in nativescript.config.ts.

init/dev/build upgrade the old unmodified generated PostCSS config and save a
.before-native-tailwind backup. Custom configs and existing style files are preserved;
add the wrapper last yourself if setup reports a custom pipeline. Rebuild after migration.
The unit fix can enlarge spacing that previously rendered incorrectly as 1 DIP.
Review screens which compensated with unusually large spacing values.

When diagnosing spacing, inspect the parent layout, gap, child margins, component
inline styles, and safe-area padding before adding more classes. Verify the screen
on the target device; a successful CSS compile is not a visual layout test.

## Android layout pitfalls

Reported by developers building real apps on Android. Check these first when a
screen behaves differently on the device than you expect.

- Nested taps fire twice. A @tap on a view inside another view that also has @tap
  runs both handlers; NativeScript has no stopPropagation. Keep tappable areas from
  nesting (put the outer handler on a sibling layer behind the content), or have the
  outer handler ignore a tap the inner one has just handled.
- A quick second tap on a plain view is dropped. @tap on a layout or Label goes
  through Android's double-tap detection, which swallows a second tap within about
  300 ms. For anything users tap repeatedly (counters, steppers, list rows, cards),
  use NButton, or v-tap="handler" instead of @tap on any other view: both use
  Android's click listener, count every tap, and add a ripple (v-tap.noripple for
  none). Don't put @tap and v-tap on the same element.
- Keep one stable child in a ScrollView. A ScrollView holds exactly one view, and
  replacing that child (v-if/v-else or a changing :key directly under the
  ScrollView) has crashed Android. Put one layout directly inside the ScrollView and
  switch content inside that layout. NPage already does this for its content.
- Prefer visibility to v-if for content that changes while a page is being shown.
  Views added by v-if during navigation or the first layout pass have rendered
  incorrectly. Toggle visibility ('visible' / 'collapse') on views that already
  exist instead; NTabs works this way.
- Avoid percentage widths inside a centred flex column. A child with a % width in an
  NFlex column with items-center has rendered wider than its box (rounded buttons
  overflowing their outline). Give it a fixed width, or let it stretch (self-stretch)
  and use horizontal margins.
- SVG icons are parsed natively every time a view is created. <NSvg> passes markup
  to @nativescript-community/ui-svg, which re-parses it for each view, and offers no
  way to reuse a parsed icon. resolveIconSvg() caches the markup, but for an icon
  repeated down a long list, prefer a PNG or font icon (res://...), or keep the
  views alive (NTabs, ListView's recycling) rather than recreating them.

## Debugging release builds

Release builds remove every console.* call (@nativescript/webpack sets terser's
drop_console in production), so logging that worked in debug prints nothing.

- Measure frame times on the device instead: adb shell dumpsys gfxinfo <appId>
  reports rendered frames and janky frames (add reset to start a new measurement).
- To keep console output in a release build while you investigate, add this to
  webpack.config.cjs before return webpack.resolveConfig(), and remove it afterwards:

    webpack.chainWebpack((config) => {
      config.optimization.minimizer('TerserPlugin').tap((args) => {
        args[0].terserOptions.compress.drop_console = false
        return args
      })
    })
