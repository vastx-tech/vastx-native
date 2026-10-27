const nativeTailwind = require('@nativescript/tailwind')
const valueParser = require('postcss-value-parser')

// NativeScript 9 supports these, but @nativescript/tailwind 4.0.10's
// property filter omits them. Keep this exception list small and tested.
//
// gap/row-gap/column-gap were deliberately removed from this list (see
// ARCHITECTURE.md's own row on this): confirmed on a real Android device
// that a non-zero row-gap on a <FlexboxLayout> (<NFlex>) silently drops
// its last child from the native view tree entirely — not a layout
// glitch, a missing child, reproduced with row-gap alone (no column-gap
// involved), regardless of which element was last. A real bug in
// NativeScript's own compiled org.nativescript.widgets.FlexboxLayout
// widget, not something fixable from this JS-level adapter. Letting
// @nativescript/tailwind's own upstream filter strip `gap-*` back out to
// a no-op is safer than a "supported" utility that can eat content.
const preservedProperties = new Set([
  'max-width', 'max-height',
  'white-space', 'text-overflow'
])

module.exports = () => ({
  postcssPlugin: 'vastx-native-tailwind',
  async OnceExit(root, { result }) {
    const preserved = new Map()
    root.walkDecls((decl) => {
      // Upstream's rem regex mishandles multi-digit fractional lengths
      // (12.5rem). Parse numeric tokens, leaving URLs and strings alone.
      const parsed = valueParser(decl.value)
      parsed.walk((node) => {
        if (node.type === 'function' && node.value.toLowerCase() === 'url') return false
        if (node.type !== 'word') return
        const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))rem$/i.exec(node.value)
        if (match) node.value = String(Number((Number(match[1]) * 16).toFixed(6)))
      })
      decl.value = parsed.toString()
      if (preservedProperties.has(decl.prop)) {
        preserved.set(decl, decl.prop)
        // Upstream keeps custom properties and still normalizes their values.
        decl.prop = `--vastx-native-preserve-${decl.prop}`
      }
    })
    try {
      const output = await nativeTailwind.process(root, { from: result.opts.from, map: false })
      result.messages.push(...output.messages)
    } finally {
      for (const [decl, prop] of preserved) decl.prop = prop
    }
  }
})
module.exports.postcss = true
