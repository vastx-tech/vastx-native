import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ensureIosInfoPlistKeys } from '../lib/ios-infoplist-fix.mjs'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vastx-native-plist-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

// The exact broken Info.plist `ns platform add ios` scaffolded on a real
// project — reproduced directly, not synthesized from a guess (see
// ios-infoplist-fix.mjs's own comment for the full trail, including the
// upstream NativeScript CLI issue this matches).
const BROKEN_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDisplayName</key>
\t<string>job-portal</string>
\t<key>CFBundleName</key>
\t<string>jobportal</string>
</dict>
</plist>
`

test('fills in every missing required key on a bare Info.plist (no storyboard file)', (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'App_Resources/iOS'), { recursive: true })
  const path = join(dir, 'App_Resources/iOS/Info.plist')
  writeFileSync(path, BROKEN_PLIST)

  ensureIosInfoPlistKeys(dir)

  const content = readFileSync(path, 'utf8')
  assert.match(content, /<key>CFBundleExecutable<\/key>\s*<string>\$\(EXECUTABLE_NAME\)<\/string>/)
  assert.match(content, /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/)
  assert.match(content, /<key>CFBundlePackageType<\/key>\s*<string>APPL<\/string>/)
  assert.match(content, /<key>CFBundleShortVersionString<\/key>\s*<string>1\.0<\/string>/)
  assert.match(content, /<key>CFBundleVersion<\/key>\s*<string>1<\/string>/)
  // No LaunchScreen.storyboard file exists in this fixture — a real,
  // reproduced case (see ios-infoplist-fix.mjs's own comment) where
  // pointing UILaunchStoryboardName at a nonexistent file would be a hard
  // launch crash, strictly worse than the scaling bug this fixes. Must use
  // the storyboard-less UILaunchScreen fallback instead.
  assert.match(content, /<key>UILaunchScreen<\/key>\s*<dict\s*\/>/)
  assert.doesNotMatch(content, /<key>UILaunchStoryboardName<\/key>/)
  assert.match(content, /<key>UIRequiredDeviceCapabilities<\/key>\s*<array>[\s\S]*?<\/array>/)
  assert.match(content, /<key>UIApplicationSceneManifest<\/key>\s*<dict>[\s\S]*?<\/dict>/)
  // Untouched: not this function's job to alter keys that already exist.
  assert.match(content, /<key>CFBundleDisplayName<\/key>\s*<string>job-portal<\/string>/)
  // Every opening tag this function can introduce (plain string values, one
  // <array>, one <dict>) has a matching close — a real, if crude, check
  // that the insertion logic never produces malformed XML. A self-closing
  // <dict/> has no separate opening/closing tag to balance, so exclude it.
  const withoutSelfClosingDict = content.replace(/<dict\s*\/>/g, '')
  for (const tag of ['dict', 'array']) {
    const opens = (withoutSelfClosingDict.match(new RegExp(`<${tag}>`, 'g')) ?? []).length
    const closes = (withoutSelfClosingDict.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    assert.equal(opens, closes, `mismatched <${tag}> tags`)
  }
})

test('points at the real storyboard when LaunchScreen.storyboard exists', (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'App_Resources/iOS'), { recursive: true })
  writeFileSync(join(dir, 'App_Resources/iOS/LaunchScreen.storyboard'), '<?xml version="1.0"?><document/>')
  const path = join(dir, 'App_Resources/iOS/Info.plist')
  writeFileSync(path, BROKEN_PLIST)

  ensureIosInfoPlistKeys(dir)

  const content = readFileSync(path, 'utf8')
  assert.match(content, /<key>UILaunchStoryboardName<\/key>\s*<string>LaunchScreen<\/string>/)
  assert.doesNotMatch(content, /<key>UILaunchScreen<\/key>/)
})

test('never adds a launch-screen key when one already exists', (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'App_Resources/iOS'), { recursive: true })
  const path = join(dir, 'App_Resources/iOS/Info.plist')
  const custom = BROKEN_PLIST.replace(
    '<dict>',
    '<dict>\n\t<key>UILaunchStoryboardName</key>\n\t<string>CustomLaunch</string>'
  )
  writeFileSync(path, custom)

  ensureIosInfoPlistKeys(dir)

  const content = readFileSync(path, 'utf8')
  assert.match(content, /<key>UILaunchStoryboardName<\/key>\s*<string>CustomLaunch<\/string>/)
  assert.doesNotMatch(content, /<key>UILaunchScreen<\/key>/)
})

test('is idempotent and never duplicates a key', (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'App_Resources/iOS'), { recursive: true })
  const path = join(dir, 'App_Resources/iOS/Info.plist')
  writeFileSync(path, BROKEN_PLIST)

  ensureIosInfoPlistKeys(dir)
  const once = readFileSync(path, 'utf8')
  ensureIosInfoPlistKeys(dir)
  const twice = readFileSync(path, 'utf8')

  assert.equal(twice, once)
  assert.equal((twice.match(/CFBundleExecutable/g) ?? []).length, 1)
})

test('never overwrites an existing CFBundleExecutable value', (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'App_Resources/iOS'), { recursive: true })
  const path = join(dir, 'App_Resources/iOS/Info.plist')
  const custom = BROKEN_PLIST.replace(
    '<dict>',
    '<dict>\n\t<key>CFBundleExecutable</key>\n\t<string>SomeCustomName</string>'
  )
  writeFileSync(path, custom)

  ensureIosInfoPlistKeys(dir)

  assert.match(readFileSync(path, 'utf8'), /<key>CFBundleExecutable<\/key>\s*<string>SomeCustomName<\/string>/)
})

test('no-op when App_Resources/iOS was never scaffolded', (t) => {
  const dir = fixture(t)
  assert.doesNotThrow(() => ensureIosInfoPlistKeys(dir))
})
