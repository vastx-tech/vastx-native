import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureMarkedBlock } from './marked-block.mjs'

/**
 * package.json's own `version` field (already standard, already what
 * `npm version` itself would bump) is the single source of truth for the
 * app's release version. A second field, `nativeVersionCode`, tracks
 * Android's separate integer build number — Play Store requires it to
 * monotonically increase across releases, which a semver string alone
 * can't express (two releases can share a patch-bumped version but still
 * need distinct versionCodes, e.g. a resubmission).
 */
export function readVersion(projectRoot) {
  const pkgPath = join(projectRoot, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return {
    version: pkg.version ?? '1.0.0',
    versionCode: pkg.nativeVersionCode ?? 1
  }
}

export function writeVersion(projectRoot, { version, versionCode }) {
  const pkgPath = join(projectRoot, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.version = version
  pkg.nativeVersionCode = versionCode
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

export function bumpSemver(version, part) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`[vastx-native] "${version}" isn't a plain major.minor.patch version — bump it by hand instead.`)
  }
  let [major, minor, patch] = match.slice(1).map(Number)
  if (part === 'major') { major++; minor = 0; patch = 0 }
  else if (part === 'minor') { minor++; patch = 0 }
  else if (part === 'patch') { patch++ }
  else { throw new Error(`[vastx-native] Usage: vastx-native version bump <major|minor|patch>`) }
  return `${major}.${minor}.${patch}`
}

/**
 * Writes android.defaultConfig.versionCode/versionName into
 * App_Resources/Android/app.gradle — confirmed a real, standard Gradle
 * `apply from:` include (build.gradle: `apply from: pathToAppGradle`),
 * not something vastx-native invented, and defaultConfig's version fields
 * are AGP's own documented mechanism for overriding the manifest's
 * android:versionCode/versionName attributes. Deliberately not editing
 * the manifest directly: platforms/android/app/src/main/AndroidManifest.xml
 * is regenerated from @nativescript/android's own template on every
 * `ns platform add` (confirmed earlier — the same reason the drawable/icon
 * fallback and gradle.properties tuning both patch App_Resources/platform-
 * scaffolding files instead), so a direct manifest edit wouldn't survive.
 *
 * Idempotent via a marker block: reruns replace only vastx-native's own
 * section, never anything else a project's app.gradle might already have.
 */
function syncAndroidVersion(projectRoot, version, versionCode) {
  const path = join(projectRoot, 'App_Resources', 'Android', 'app.gradle')
  ensureMarkedBlock(path, 'managed version block', `
android {
    defaultConfig {
        versionCode ${versionCode}
        versionName "${version}"
    }
}
`)
}

/**
 * CFBundleShortVersionString (user-facing version)/CFBundleVersion (build
 * number) are Apple's own long-standing, documented Info.plist keys — not
 * verified on-device (no iOS tooling in this framework's own development
 * environment so far, same caveat as everything else iOS-related here).
 * Only touches the file if App_Resources/iOS was actually scaffolded
 * (i.e. `ns platform add ios` has run) — same "only touch what a project
 * actually has" rule the Android side follows.
 */
function syncIosVersion(projectRoot, version, versionCode) {
  const path = join(projectRoot, 'App_Resources', 'iOS', 'Info.plist')
  if (!existsSync(path)) return

  let content = readFileSync(path, 'utf8')
  content = replacePlistString(content, 'CFBundleShortVersionString', version)
  content = replacePlistString(content, 'CFBundleVersion', String(versionCode))
  writeFileSync(path, content)
}

function replacePlistString(content, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`)
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${value}$2`)
  }
  // Key not present yet — insert it right after the opening <dict>, the
  // simplest valid insertion point in a plist that doesn't require
  // parsing the whole structure.
  return content.replace('<dict>', `<dict>\n\t<key>${key}</key>\n\t<string>${value}</string>`)
}

export function syncVersion(projectRoot) {
  const { version, versionCode } = readVersion(projectRoot)
  syncAndroidVersion(projectRoot, version, versionCode)
  syncIosVersion(projectRoot, version, versionCode)
  return { version, versionCode }
}
