import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const XML_MARKER = '<!-- vastx-native: dev-only cleartext exception for useWebSocket() -->'

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
${XML_MARKER}
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`

const DEBUG_MANIFEST_OVERLAY = `<?xml version="1.0" encoding="utf-8"?>
${XML_MARKER}
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:networkSecurityConfig="@xml/network_security_config" />
</manifest>
`

/**
 * Android blocks cleartext (non-TLS) traffic by default for apps
 * targeting API 28+ — confirmed directly on a real device: `ws://` to a
 * loopback dev server failed with "CLEARTEXT communication to 127.0.0.1
 * not permitted by network security policy" the first time useWebSocket()
 * was tested end-to-end. Same class of problem Flutter/React Native both
 * solve the same way: a debug-only network security config that permits
 * cleartext only to loopback dev hosts, leaving release builds with
 * Android's secure-by-default behavior untouched (production apps should
 * use `wss://` regardless).
 *
 * Written into `App_Resources/Android/src/debug/...`, not `src/main/...`:
 * confirmed directly (reading platforms/android/app/build.gradle and
 * @nativescript/android's own build.gradle) that App_Resources/Android's
 * `src/<sourceSet>/` layout is a real Android Gradle source-set tree, and
 * `ns platform add`/`ns prepare` copy it as-is into
 * `platforms/android/app/src/<sourceSet>/` — so a `debug/` subtree here
 * only ever reaches debug builds, the same idiom a plain Android Studio
 * project would use.
 */
export function ensureNetworkSecurityConfig(projectRoot) {
  const debugDir = join(projectRoot, 'App_Resources', 'Android', 'src', 'debug')
  const xmlPath = join(debugDir, 'res', 'xml', 'network_security_config.xml')
  const manifestPath = join(debugDir, 'AndroidManifest.xml')

  writeIfNotManaged(xmlPath, NETWORK_SECURITY_CONFIG)
  writeIfNotManaged(manifestPath, DEBUG_MANIFEST_OVERLAY)
}

function writeIfNotManaged(path, content) {
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8')
    if (existing.includes(XML_MARKER)) return
    // A file already exists here that we didn't write (a project that had
    // its own debug manifest/network config before adopting
    // useWebSocket()) — don't clobber real user content silently.
    console.log(`[vastx-native] ${path} already exists and isn't vastx-native-managed — skipping (merge the cleartext exception in by hand if useWebSocket() needs it)`)
    return
  }
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}
