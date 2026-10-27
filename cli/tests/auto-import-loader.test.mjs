import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

const require = createRequire(import.meta.url)
const autoImportLoader = require('../lib/auto-import-loader.cjs')

const ENTRIES = [
  { name: 'placeholder', from: 'vastx-native/runtime/style.js' },
  { name: 'size', from: 'vastx-native/runtime/style.js' },
  { name: 'padding', from: 'vastx-native/runtime/style.js' },
  { name: 'formatPrice', from: '/app/utils/formatPrice.ts' },
  { name: 'useCart', from: '/app/composables/useCart.ts' }
]

const root = mkdtempSync(join(tmpdir(), 'vastx-native-auto-import-'))
mkdirSync(join(root, '.vastx-native'))
writeFileSync(join(root, '.vastx-native/auto-imports.json'), JSON.stringify(ENTRIES))
after(() => rmSync(root, { recursive: true, force: true }))

function run(source, resourcePath = join(root, 'app/components/Thing.vue'), resourceQuery = '?vue&type=script&setup=true&lang.ts') {
  const errors = []
  const warnings = []
  const output = autoImportLoader.call({
    rootContext: root,
    resourcePath,
    resourceQuery: resourcePath.endsWith('.vue') ? resourceQuery : '',
    emitError: e => errors.push(String(e.message ?? e)),
    emitWarning: e => warnings.push(String(e.message ?? e))
  }, source)
  return { output, errors, warnings }
}

const importOf = name => new RegExp(`import \\{ ${name} \\}`)

test('a prop used in the template is never shadowed by an auto-import', () => {
  const { output } = run(`<template>
  <TextField :hint="placeholder" :width="size" />
</template>

<script setup lang="ts">
defineProps<{ placeholder: string, size: number }>()
</script>
`)
  assert.doesNotMatch(output, importOf('placeholder'))
  assert.doesNotMatch(output, importOf('size'))
})

test('runtime-declared and destructured props are respected too', () => {
  const { output } = run(`<template><Label :text="placeholder" :height="size" /></template>
<script setup>
const props = defineProps(['placeholder'])
const { size } = defineProps({ size: Number })
</script>`)
  assert.doesNotMatch(output, importOf('placeholder'))
  assert.doesNotMatch(output, importOf('size'))
})

test('names used only in the template are imported into <script setup>', () => {
  const { output } = run(`<template><Label :text="formatPrice(12)" /></template>
<script lang="ts">
export interface Item { id: string }
</script>
<script setup lang="ts">
const x = 1
</script>`)
  const setupStart = output.indexOf('<script setup')
  const importAt = output.search(importOf('formatPrice'))
  assert.ok(importAt > setupStart, 'import must land in <script setup>, not the plain <script> block')
})

test('template scope variables (v-for aliases, slot props) are not imported', () => {
  const { output } = run(`<template>
  <StackLayout v-for="size in sizes" :key="size"><Label :text="size" /></StackLayout>
  <Comp v-slot="{ padding }"><Label :text="padding" /></Comp>
</template>
<script setup>
const sizes = [1, 2]
</script>`)
  assert.doesNotMatch(output, importOf('size'))
  assert.doesNotMatch(output, importOf('padding'))
})

test('script usage is imported; member access, object keys and comments are not', () => {
  const { output } = run(`<template><Label text="hi" /></template>
<script setup>
// useCart() is mentioned in a comment only
const style = { size: 1, padding: theme.padding }
const cart = useCart()
</script>`)
  assert.match(output, importOf('useCart'))
  assert.doesNotMatch(output, importOf('size'))
  assert.doesNotMatch(output, importOf('padding'))
})

test('multi-line imports and local destructuring count as already declared', () => {
  const { output } = run(`import {
  formatPrice,
} from '~/utils/money'
const { size } = useThing()
function f(padding: number) { return padding }
export const total = formatPrice(size)
`, join(root, 'app/stores/cart.ts'))
  assert.doesNotMatch(output, importOf('formatPrice'))
  assert.doesNotMatch(output, importOf('size'))
  assert.doesNotMatch(output, importOf('padding'))
})

test('a plain .ts file still gets the imports it needs', () => {
  const { output } = run(`export const total = () => formatPrice(useCart().sum)\n`, join(root, 'app/stores/cart.ts'))
  assert.match(output, importOf('formatPrice'))
  assert.match(output, importOf('useCart'))
})

test('script code calling a helper that a prop also names fails the build loudly', () => {
  const { output, errors } = run(`<template><Label :text="placeholder" /></template>
<script setup>
defineProps(['placeholder'])
const hint = placeholder({ color: 'gray' })
</script>`)
  assert.doesNotMatch(output, importOf('placeholder'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /placeholder/)
})

test('project files contribute their real exports, not their filename', async () => {
  const { collectAutoImportEntries, renderAutoImportTypes } = await import('../lib/auto-imports.mjs')
  const project = mkdtempSync(join(tmpdir(), 'vastx-native-exports-'))
  try {
    mkdirSync(join(project, 'app/utils'), { recursive: true })
    mkdirSync(join(project, 'app/composables'), { recursive: true })
    writeFileSync(join(project, 'app/utils/motion.ts'), `export const fadeIn = 1
export function slideUp() {}
export type Easing = string
export interface Spring { k: number }
const hidden = 2
export { hidden as revealed }
`)
    writeFileSync(join(project, 'app/composables/useTheme.ts'), 'export default function () { return 1 }\n')
    mkdirSync(join(project, 'app/stores'))
    writeFileSync(join(project, 'app/stores/cart.ts'), "export const useCartStore = defineStore('cart', () => ({}))\n")
    writeFileSync(join(project, 'app/utils/types.d.ts'), 'export declare const ambient: number\n')

    const entries = collectAutoImportEntries(project)
    const names = entries.map(e => e.name)
    for (const name of ['fadeIn', 'slideUp', 'revealed', 'useTheme', 'useCartStore']) assert.ok(names.includes(name), name)
    for (const name of ['motion', 'cart', 'Easing', 'Spring', 'hidden', 'ambient']) assert.ok(!names.includes(name), name)
    assert.equal(entries.find(e => e.name === 'useTheme').export, 'default')

    const dts = renderAutoImportTypes(entries)
    assert.match(dts, /const useTheme: typeof import\("[^"]+useTheme\.ts"\)\['default'\]/)
    assert.match(dts, /interface ComponentCustomProperties \{[\s\S]*readonly fadeIn:/)

    assert.doesNotMatch(dts, /declare module 'pinia'/)
    assert.match(renderAutoImportTypes([], [], { pinia: true }), /declare module 'pinia'[\s\S]*persist\?: boolean \| import\('vastx-native\/runtime\/pinia-persist\.js'\)\.PersistOptions/)
    assert.ok(entries.some(e => e.name === 'useStorage'))

    const withComponents = renderAutoImportTypes([], [{ tag: 'NTabs', specifier: 'vastx-native/runtime/components/NTabs.vue' }])
    assert.match(withComponents, /interface GlobalComponents \{\s*NTabs: typeof import\("vastx-native\/runtime\/components\/NTabs\.vue"\)\['default'\]/)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

test('a default export is imported under the file name', () => {
  const project = mkdtempSync(join(tmpdir(), 'vastx-native-default-'))
  try {
    mkdirSync(join(project, '.vastx-native'))
    writeFileSync(join(project, '.vastx-native/auto-imports.json'), JSON.stringify([{ name: 'useTheme', from: '/app/composables/useTheme.ts', export: 'default' }]))
    const output = autoImportLoader.call({ rootContext: project, resourcePath: join(project, 'app/a.ts'), resourceQuery: '' }, 'export const t = useTheme()\n')
    assert.match(output, /import \{ default as useTheme \} from "\/app\/composables\/useTheme\.ts";/)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})
