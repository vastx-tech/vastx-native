import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { generateEntry } from '../lib/generate-entry.mjs'
import { ensureProjectSetup } from '../lib/ensure-project-setup.mjs'
import { nativeIndexPage, nuxtConfig, packageJson } from '../lib/scaffold-templates.mjs'

test('native starter omits Tailwind and has a usable page', () => {
  const pkg = JSON.parse(packageJson('demo'))
  assert.equal(pkg.devDependencies.tailwindcss, undefined)
  assert.equal(pkg.devDependencies.postcss, undefined)
  assert.match(nuxtConfig('org.demo', 'Demo'), /styling: "native"/)
  assert.match(nativeIndexPage(), /<NPage/)
  assert.ok(JSON.parse(packageJson('demo', undefined, 'tailwind')).devDependencies.tailwindcss)
})

test('generated entry registers only tags used by app templates', () => {
  const root = mkdtempSync(join(tmpdir(), 'vastx-native-light-'))
  try {
    mkdirSync(join(root, 'app/pages'), { recursive: true })
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'app/pages/index.vue'), '<template><NPage><NButton text="Go" /></NPage></template>')
    generateEntry({ projectRoot: root })
    const entry = readFileSync(join(root, '.vastx-native/app.js'), 'utf8')
    assert.match(entry, /components\/NPage.vue/)
    assert.match(entry, /components\/NButton.vue/)
    assert.doesNotMatch(entry, /components\/NSkeleton.vue/)

    writeFileSync(join(root, 'app/pages/index.vue'), '<template><component :is="selected" /></template>')
    generateEntry({ projectRoot: root })
    assert.match(readFileSync(join(root, '.vastx-native/app.js'), 'utf8'), /components\/NSkeleton.vue/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('native styling setup leaves Tailwind uninstalled', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vastx-native-style-'))
  try {
    writeFileSync(join(root, 'package.json'), '{}')
    await ensureProjectSetup(root, { styling: 'native', plugins: [] }, [])
    assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), '{}')
    assert.throws(() => readFileSync(join(root, 'tailwind.config.cjs')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
