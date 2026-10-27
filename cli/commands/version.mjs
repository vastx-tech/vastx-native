import { bumpSemver, readVersion, syncVersion, writeVersion } from '../lib/app-version.mjs'

/**
 * `vastx-native version [show|bump <part>|sync]` — deliberately never
 * wired into `init`'s automatic flow the way gradle-tuning/splash-
 * branding/Tailwind-setup are: those are safe to silently redo on every
 * init because they're idempotent config, but bumping a version number is
 * a real, consequential developer decision (Play Store requires
 * versionCode to only ever increase) — this only runs when explicitly
 * invoked.
 */
export async function version(action = 'show', part) {
  const root = process.cwd()

  if (action === 'show' || !action) {
    const { version: v, versionCode } = readVersion(root)
    console.log(`[vastx-native] version ${v} (versionCode ${versionCode})`)
    return
  }

  if (action === 'bump') {
    const current = readVersion(root)
    const nextVersion = bumpSemver(current.version, part)
    const nextVersionCode = current.versionCode + 1
    writeVersion(root, { version: nextVersion, versionCode: nextVersionCode })
    syncVersion(root)
    console.log(`[vastx-native] ${current.version} (versionCode ${current.versionCode}) -> ${nextVersion} (versionCode ${nextVersionCode})`)
    console.log('[vastx-native] Synced to App_Resources/Android/app.gradle' + (nextVersionCode ? ' and App_Resources/iOS/Info.plist if present' : ''))
    return
  }

  if (action === 'sync') {
    const { version: v, versionCode } = syncVersion(root)
    console.log(`[vastx-native] Synced version ${v} (versionCode ${versionCode}) to native platform files.`)
    return
  }

  throw new Error('[vastx-native] Usage: vastx-native version [show|bump <major|minor|patch>|sync]')
}
