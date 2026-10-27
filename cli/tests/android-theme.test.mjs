import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ensureAndroidMinSdk, ensureAndroidTheme, isDark } from '../lib/android-theme.mjs'
import { nuxtConfig, packageJson } from '../lib/scaffold-templates.mjs'

function withProject(fn) {
  const root = mkdtempSync(join(tmpdir(), 'vastx-native-theme-'))
  try {
    return fn(root, rel => join(root, 'App_Resources/Android/src/main/res', rel))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('no native.theme leaves the template theme alone', () => withProject((root, res) => {
  ensureAndroidTheme(root, undefined)
  assert.equal(existsSync(res('values/styles.xml')), false)
}))

test('a dark background gives a dark theme with that window background', () => withProject((root, res) => {
  ensureAndroidTheme(root, { background: '#0b1020', primary: '#7C5CFF', accent: '#22d3ee' })
  const styles = readFileSync(res('values/styles.xml'), 'utf8')
  assert.match(styles, /parent="Theme\.AppCompat\.NoActionBar"/)
  assert.match(styles, /android:windowBackground">@color\/ns_background/)
  assert.match(readFileSync(res('values/colors.xml'), 'utf8'), /ns_background">#0B1020/)
  // the template's v21 colours redefine ns_accent, so ours must be there too
  assert.match(readFileSync(res('values-v21/colors.xml'), 'utf8'), /ns_accent">#22D3EE/)
  assert.match(readFileSync(res('values-v21/styles.xml'), 'utf8'), /parent="android:Widget\.Material\.DatePicker"/)
  assert.match(readFileSync(res('values-v23/styles.xml'), 'utf8'), /windowLightStatusBar">false/)
}))

test('a light background keeps the light theme and dark status bar icons', () => withProject((root, res) => {
  ensureAndroidTheme(root, { background: '#F8FAFC' })
  assert.match(readFileSync(res('values/styles.xml'), 'utf8'), /parent="Theme\.AppCompat\.Light\.NoActionBar"/)
  assert.match(readFileSync(res('values/styles.xml'), 'utf8'), /ThemeOverlay\.AppCompat\.ActionBar/)
}))

test('toolbar text contrasts with the toolbar colour, not the window', () => withProject((root, res) => {
  // seen on a device: a dark primary toolbar on a light app had black title text
  ensureAndroidTheme(root, { background: '#F8FAFC', primary: '#4F46E5' })
  // NativeScript builds the Toolbar in code, so a `theme` overlay in its style
  // is ignored; titleTextColor is what actually reaches the title.
  assert.match(readFileSync(res('values/styles.xml'), 'utf8'), /titleTextColor">#FFFFFF/)
  assert.match(readFileSync(res('values-v23/styles.xml'), 'utf8'), /windowLightStatusBar">true/)
}))

test('the project\'s own resource files are never overwritten', () => withProject((root, res) => {
  mkdirSync(res('values'), { recursive: true })
  writeFileSync(res('values/styles.xml'), '<resources>mine</resources>')
  const skipped = ensureAndroidTheme(root, { background: '#000000' })
  assert.deepEqual(skipped, ['values/styles.xml'])
  assert.equal(readFileSync(res('values/styles.xml'), 'utf8'), '<resources>mine</resources>')
  // generated files are regenerated, e.g. after a colour change
  ensureAndroidTheme(root, { background: '#111111' })
  assert.match(readFileSync(res('values/colors.xml'), 'utf8'), /#111111/)
}))

test('invalid colours fail with a clear message', () => withProject((root) => {
  assert.throws(() => ensureAndroidTheme(root, { background: 'navy' }), /native\.theme\.background must be a hex colour/)
}))

test('isDark splits at the perceptual midpoint', () => {
  assert.equal(isDark('#0B1020'), true)
  assert.equal(isDark('#4F46E5'), true)
  assert.equal(isDark('#F8FAFC'), false)
  assert.equal(isDark('#FFD54F'), false)
})

test('minSdk defaults to 23 and is rewritten in place', () => withProject((root) => {
  const gradle = join(root, 'App_Resources/Android/app.gradle')
  mkdirSync(join(root, 'App_Resources/Android'), { recursive: true })
  writeFileSync(gradle, '// my own config\n')
  ensureAndroidMinSdk(root)
  assert.match(readFileSync(gradle, 'utf8'), /minSdkVersion 23/)
  ensureAndroidMinSdk(root, 26)
  const content = readFileSync(gradle, 'utf8')
  assert.match(content, /minSdkVersion 26/)
  assert.doesNotMatch(content, /minSdkVersion 23/)
  assert.match(content, /my own config/)
  assert.throws(() => ensureAndroidMinSdk(root, 19), /at least 21/)
}))

test('the starter ships a theme, a typecheck script and vue-tsc', () => {
  const pkg = JSON.parse(packageJson('demo'))
  assert.equal(pkg.scripts.typecheck, 'vue-tsc --noEmit')
  assert.ok(pkg.devDependencies['vue-tsc'])
  assert.match(nuxtConfig('org.demo', 'Demo'), /theme: \{\s*background: '#F8FAFC'/)
})

test('platforms/android goes on PATH only when Windows skips the current directory', async () => {
  const { childEnv } = await import('../lib/run.mjs')
  const env = { Path: 'C:/Windows', NoDefaultCurrentDirectoryInExePath: '1' }
  const patched = childEnv('D:/app', env, 'win32')
  assert.equal(patched.Path, `${join('D:/app', 'platforms', 'android')};C:/Windows`)
  assert.equal(env.Path, 'C:/Windows', 'the parent environment is not modified')
  assert.equal(childEnv('D:/app', { Path: 'C:/Windows' }, 'win32').Path, 'C:/Windows')
  assert.equal(childEnv('/app', { PATH: '/usr/bin', NoDefaultCurrentDirectoryInExePath: '1' }, 'darwin').PATH, '/usr/bin')
})

test('the Gradle daemon is stopped after builds on small machines only, unless configured', async () => {
  const { stopGradleDaemonIfLowMemory } = await import('../lib/gradle-tuning.mjs')
  const root = mkdtempSync(join(tmpdir(), 'vastx-native-gradle-'))
  try {
    mkdirSync(join(root, 'platforms/android'), { recursive: true })
    writeFileSync(join(root, 'platforms/android/gradlew.bat'), '')
    writeFileSync(join(root, 'platforms/android/gradlew'), '')
    const calls = []
    const spawn = (...args) => { calls.push(args); return { status: 0 } }
    const GB = 1024 ** 3

    assert.equal(stopGradleDaemonIfLowMemory(root, undefined, { total: 8 * GB, platform: 'win32', spawn }), true)
    assert.match(calls[0][0], /^".*gradlew\.bat" --stop$/)
    assert.equal(calls[0][1].shell, true)
    assert.equal(stopGradleDaemonIfLowMemory(root, undefined, { total: 32 * GB, platform: 'win32', spawn }), false)
    assert.equal(stopGradleDaemonIfLowMemory(root, false, { total: 8 * GB, platform: 'win32', spawn }), false)
    assert.equal(stopGradleDaemonIfLowMemory(root, true, { total: 32 * GB, platform: 'linux', spawn }), true)
    assert.deepEqual(calls[1].slice(1, 2), [['--stop']])
    assert.equal(calls.length, 2)
    assert.equal(stopGradleDaemonIfLowMemory(join(root, 'missing'), true, { spawn }), false, 'no platforms/android yet')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('marked blocks keep the file\'s line endings and skip unchanged writes', async () => {
  const { ensureMarkedBlock } = await import('../lib/marked-block.mjs')
  const { statSync, utimesSync } = await import('node:fs')
  const root = mkdtempSync(join(tmpdir(), 'vastx-native-block-'))
  try {
    const file = join(root, 'app.gradle')
    writeFileSync(file, '// mine\r\nandroid {}\r\n')
    ensureMarkedBlock(file, 'thing', 'a {\n  b 1\n}')
    const once = readFileSync(file, 'utf8')
    assert.doesNotMatch(once.replace(/\r\n/g, ''), /\n/, 'a CRLF file stays all-CRLF')
    assert.match(once, /a \{\r\n {2}b 1\r\n\}/)

    // A rerun with the same block (every build) leaves the file untouched.
    const old = new Date('2020-01-01')
    utimesSync(file, old, old)
    ensureMarkedBlock(file, 'thing', 'a {\n  b 1\n}')
    assert.equal(readFileSync(file, 'utf8'), once)
    assert.equal(statSync(file).mtime.getTime(), old.getTime(), 'not rewritten')

    ensureMarkedBlock(file, 'thing', 'a {\n  b 2\n}')
    assert.match(readFileSync(file, 'utf8'), /b 2\r\n/)
    assert.doesNotMatch(readFileSync(file, 'utf8'), /b 1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('regenerating the theme keeps CRLF files untouched', () => withProject((root, res) => {
  ensureAndroidTheme(root, { background: '#0B1020' })
  const crlf = readFileSync(res('values/styles.xml'), 'utf8').replace(/\n/g, '\r\n')
  writeFileSync(res('values/styles.xml'), crlf) // as git checks it out on Windows
  ensureAndroidTheme(root, { background: '#0B1020' })
  assert.equal(readFileSync(res('values/styles.xml'), 'utf8'), crlf)
  // A real change keeps the file's CRLF endings too.
  writeFileSync(res('values/colors.xml'), readFileSync(res('values/colors.xml'), 'utf8').replace(/\n/g, '\r\n'))
  ensureAndroidTheme(root, { background: '#111111' })
  const colors = readFileSync(res('values/colors.xml'), 'utf8')
  assert.match(colors, /#111111/)
  assert.doesNotMatch(colors.replace(/\r\n/g, ''), /\n/)
}))
