import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import { ensureTailwindSetup } from '../lib/tailwind-setup.mjs'
import { appCss, indexPage, postcssConfig, tailwindConfig } from '../lib/scaffold-templates.mjs'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))
const nativeTailwind = require('../lib/native-tailwind.cjs')

function configFrom(source) {
  const context = { module: { exports: {} }, require }
  vm.runInNewContext(source, context)
  return context.module.exports
}

async function compile(classes, css = appCss()) {
  const config = configFrom(tailwindConfig())
  config.content = [{ raw: classes, extension: 'vue' }]
  return postcss([tailwind(config), nativeTailwind()]).process(css, { from: undefined })
}

function declarations(result, selector) {
  const values = {}
  result.root.walkRules(selector, rule => rule.walkDecls(decl => { values[decl.prop] = decl.value }))
  return values
}

test('Tailwind spacing, typography, colors and max sizes compile to native values, gap is excluded entirely', async () => {
  const result = await compile('p-4 m-2 gap-4 gap-x-2 gap-y-3 text-base rounded-lg max-w-sm max-h-16 text-indigo-600 bg-slate-100 flex-col')
  assert.equal(declarations(result, '.p-4').padding, '16')
  assert.equal(declarations(result, '.m-2').margin, '8')
  assert.equal(declarations(result, '.text-base')['font-size'], '16')
  assert.equal(declarations(result, '.rounded-lg')['border-radius'], '8')
  assert.equal(declarations(result, '.max-w-sm')['max-width'], '384')
  assert.equal(declarations(result, '.max-h-16')['max-height'], '64')
  assert.equal(declarations(result, '.text-indigo-600').color, '#4f46e5')
  assert.equal(declarations(result, '.bg-slate-100')['background-color'], '#f1f5f9')
  assert.equal(declarations(result, '.flex-col')['flex-direction'], 'column')
  assert.doesNotMatch(result.css, /\drem\b|--vastx-native-preserve/)
  // gap/gap-x/gap-y are disabled outright (removed from TAILWIND_CORE_PLUGINS),
  // not just filtered post-generation — confirmed on a real Android device that
  // a non-zero row-gap silently drops a <FlexboxLayout>'s last child from the
  // native view tree entirely (see ARCHITECTURE.md).
  assert.doesNotMatch(result.css, /\.gap-/)
})

test('native adapter handles arbitrary and negative rem lengths without rescaling px or percentages, and drops gap from raw custom CSS too', async () => {
  const result = await compile('', '.custom { padding: 12.5rem; margin: -0.5rem; gap: 1rem 0.5rem; width: 50%; height: 24px; white-space: normal; text-overflow: ellipsis; display: grid; }')
  assert.deepEqual(declarations(result, '.custom'), {
    padding: '200', margin: '-8', width: '50%', height: '24px',
    'white-space': 'normal', 'text-overflow': 'ellipsis'
  })
  const again = await postcss([nativeTailwind()]).process(result.css, { from: undefined })
  assert.equal(again.css, result.css)
})

test('counter starter emits usable native spacing and excludes browser-only utilities', async () => {
  const result = await compile(`${indexPage()} grid absolute ring-2 hover:p-8`)
  assert.equal(declarations(result, '.p-5').padding, '20')
  assert.equal(declarations(result, '.mb-4')['margin-bottom'], '16')
  assert.equal(declarations(result, '.text-5xl')['font-size'], '48')
  assert.doesNotMatch(result.css, /display:|position:|:hover|--tw-ring|\.gap-/)
})

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vastx-native-styling-'))
  mkdirSync(join(dir, 'node_modules'))
  // Only link declared packages, not the whole repository's dependency tree.
  for (const name of ['tailwindcss', 'postcss', 'vastx-native']) {
    symlinkSync(name === 'vastx-native' ? root : join(root, 'node_modules', name), join(dir, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir')
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'styling-fixture', private: true }))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('fresh setup loads the generated PostCSS config and is idempotent', async (t) => {
  const dir = fixture(t)
  await ensureTailwindSetup(dir)
  const source = readFileSync(join(dir, 'postcss.config.cjs'), 'utf8')
  assert.equal(source, postcssConfig())
  const plugins = createRequire(join(dir, 'package.json'))('./postcss.config.cjs').plugins
  const result = await postcss(plugins).process('.example { padding: 1rem; gap: 1rem; }', { from: join(dir, 'app/app.css') })
  assert.equal(declarations(result, '.example').padding, '16')
  assert.equal(declarations(result, '.example').gap, undefined)
  assert.ok(existsSync(join(dir, 'STYLING.md')))
  assert.ok(existsSync(join(dir, 'AGENTS.md')))
  await ensureTailwindSetup(dir)
  assert.equal(readFileSync(join(dir, 'postcss.config.cjs'), 'utf8'), source)
  assert.ok(!existsSync(join(dir, 'postcss.config.cjs.before-native-tailwind')))
})

test('legacy generated config migrates once with a backup', async (t) => {
  const dir = fixture(t)
  const legacy = '// Generated config\nmodule.exports = { plugins: [require(\'tailwindcss\')] }\n'
  const path = join(dir, 'postcss.config.cjs')
  writeFileSync(path, legacy)
  await ensureTailwindSetup(dir)
  await ensureTailwindSetup(dir)
  assert.equal(readFileSync(path, 'utf8'), postcssConfig())
  assert.equal(readFileSync(`${path}.before-native-tailwind`, 'utf8'), legacy)
})

test('custom configs, styles, and agent instructions are preserved', async (t) => {
  const dir = fixture(t)
  const custom = 'module.exports = { plugins: [require("tailwindcss"), require("custom-plugin")] }'
  writeFileSync(join(dir, 'postcss.config.js'), custom)
  writeFileSync(join(dir, 'tailwind.config.js'), 'module.exports = { content: ["custom/**"] }')
  writeFileSync(join(dir, 'AGENTS.md'), 'Project-specific rules')
  mkdirSync(join(dir, 'app'))
  writeFileSync(join(dir, 'app/app.css'), '.custom { padding: 8; }')
  await ensureTailwindSetup(dir)
  assert.equal(readFileSync(join(dir, 'postcss.config.js'), 'utf8'), custom)
  assert.ok(!existsSync(join(dir, 'postcss.config.cjs')))
  assert.ok(!existsSync(join(dir, 'tailwind.config.cjs')))
  assert.equal(readFileSync(join(dir, 'app/app.css'), 'utf8'), '.custom { padding: 8; }')
  assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), 'Project-specific rules')
})

test('package-level PostCSS configuration is not shadowed', async (t) => {
  const dir = fixture(t)
  const source = JSON.stringify({ name: 'fixture', postcss: { plugins: { tailwindcss: {} } } })
  writeFileSync(join(dir, 'package.json'), source)
  await ensureTailwindSetup(dir)
  assert.ok(!existsSync(join(dir, 'postcss.config.cjs')))
  assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), source)
})

test('Tailwind v4 is rejected before existing project files are changed', async (t) => {
  const dir = fixture(t)
  const dependency = join(dir, 'node_modules/tailwindcss')
  unlinkSync(dependency)
  mkdirSync(dependency)
  writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'tailwindcss', version: '4.0.0' }))
  await assert.rejects(ensureTailwindSetup(dir), /requires Tailwind v3/)
  assert.ok(!existsSync(join(dir, 'postcss.config.cjs')))
  assert.ok(!existsSync(join(dir, 'app')))
})
