// Tailwind v3 generates utilities; the bundled @nativescript/tailwind
// adapter converts them to native CSS and preserves NativeScript 9 gaps.
// Keep this adapter last. Do not also enable upstream's v4 autoload pipeline.
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('vastx-native/cli/lib/native-tailwind.cjs')()
  ]
}
