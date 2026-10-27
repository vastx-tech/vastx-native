import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureMarkedBlock } from './marked-block.mjs'

const MARKER = '<!-- vastx-native: generated from native.theme in nuxt.config — edit there, or delete this line to take this file over -->'

/**
 * Generates the Android app theme from `native.theme` in nuxt.config:
 *
 *   native: { theme: { background: '#0B1020', primary: '#7C5CFF', accent: '#22D3EE' } }
 *
 * Without it, @nativescript/android's template theme applies: a light
 * AppCompat theme with no window background of its own, so the window
 * behind every page is white. In a dark app that white shows through for
 * a frame or two on every page transition — reported as a "white flash
 * between pages" by an external developer.
 *
 * `background` becomes the window background (and the status bar colour);
 * a dark background also switches to the dark AppCompat parent so system
 * UI (dialogs, pickers) matches, and a light one gets dark status bar
 * icons. Only written when `native.theme` is set, so existing projects
 * keep the template theme.
 *
 * Every file here *replaces* the template's file of the same name (NativeScript
 * copies App_Resources over the platform template), so each one restates
 * everything the template version had — confirmed against
 * platforms/android/app/src/main/res/values{,-v21}/{styles,colors}.xml as
 * scaffolded by @nativescript/android 9. Files without our marker are the
 * project's own and are never overwritten.
 */
export function ensureAndroidTheme(projectRoot, theme) {
  if (!theme?.background) return []

  const background = normalizeHex(theme.background, 'background')
  const primary = normalizeHex(theme.primary ?? theme.background, 'primary')
  const accent = normalizeHex(theme.accent ?? theme.primary ?? '#65ADF1', 'accent')
  const dark = isDark(background)
  const res = join(projectRoot, 'App_Resources', 'Android', 'src', 'main', 'res')
  const skipped = []

  const write = (rel, content) => {
    const path = join(res, rel)
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : undefined
    if (existing !== undefined && !existing.includes(MARKER)) {
      skipped.push(rel)
      return
    }
    // Same line endings as the file already has (CRLF on a Windows
    // checkout), and no write at all when nothing changed — otherwise every
    // build left whitespace-only diffs on these files.
    const text = existing?.includes('\r\n') ? content.replace(/\n/g, '\r\n') : content
    if (text === existing) return
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }

  const colors = `<?xml version="1.0" encoding="utf-8"?>
${MARKER}
<resources>
    <color name="ns_primary">${primary}</color>
    <color name="ns_primaryDark">${background}</color>
    <color name="ns_accent">${accent}</color>
    <color name="ns_background">${background}</color>
</resources>
`
  write('values/colors.xml', colors)
  // The template's values-v21/colors.xml redefines ns_accent, which would
  // win over ours on every device since Android 5 — so restate it there.
  write('values-v21/colors.xml', `<?xml version="1.0" encoding="utf-8"?>
${MARKER}
<resources>
    <color name="ns_accent">${accent}</color>
</resources>
`)

  write('values/styles.xml', `<?xml version="1.0" encoding="utf-8"?>
${MARKER}
<resources xmlns:android="http://schemas.android.com/apk/res/android">
    <style name="AppThemeBase" parent="${dark ? 'Theme.AppCompat.NoActionBar' : 'Theme.AppCompat.Light.NoActionBar'}">
        <item name="toolbarStyle">@style/NativeScriptToolbarStyle</item>

        <item name="colorPrimary">@color/ns_primary</item>
        <item name="colorPrimaryDark">@color/ns_primaryDark</item>
        <item name="colorAccent">@color/ns_accent</item>
        <item name="android:windowBackground">@color/ns_background</item>
        <item name="android:colorBackground">@color/ns_background</item>
    </style>

    <style name="AppTheme" parent="AppThemeBase">
    </style>

    <style name="NativeScriptToolbarStyleBase" parent="Widget.AppCompat.Toolbar">
        <item name="android:background">@color/ns_primary</item>
        <item name="theme">@style/ThemeOverlay.AppCompat${isDark(primary) ? '.Dark' : ''}.ActionBar</item>
        <item name="titleTextColor">${isDark(primary) ? '#FFFFFF' : '#DE000000'}</item>
        <item name="subtitleTextColor">${isDark(primary) ? '#B3FFFFFF' : '#8A000000'}</item>
        <item name="popupTheme">@style/ThemeOverlay.AppCompat${dark ? '.Dark' : ''}</item>
    </style>

    <style name="NativeScriptToolbarStyle" parent="NativeScriptToolbarStyleBase">
    </style>
</resources>
`)

  const v21AppThemeItems = `        <item name="android:datePickerStyle">@style/SpinnerDatePicker</item>
        <item name="android:timePickerStyle">@style/SpinnerTimePicker</item>`
  const pickerParent = dark ? 'android:Widget.Material' : 'android:Widget.Material.Light'

  write('values-v21/styles.xml', `<?xml version="1.0" encoding="utf-8"?>
${MARKER}
<resources>
    <style name="AppTheme" parent="AppThemeBase">
${v21AppThemeItems}
    </style>

    <style name="SpinnerDatePicker" parent="${pickerParent}.DatePicker">
        <item name="android:datePickerMode">spinner</item>
    </style>

    <style name="SpinnerTimePicker" parent="${pickerParent}.TimePicker">
        <item name="android:timePickerMode">spinner</item>
    </style>

    <style name="NativeScriptToolbarStyle" parent="NativeScriptToolbarStyleBase">
        <item name="android:elevation">4dp</item>
    </style>
</resources>
`)

  // Status bar icon colour (API 23+): dark icons on a light background,
  // otherwise they'd be white on white.
  write('values-v23/styles.xml', `<?xml version="1.0" encoding="utf-8"?>
${MARKER}
<resources>
    <style name="AppTheme" parent="AppThemeBase">
${v21AppThemeItems}
        <item name="android:windowLightStatusBar">${dark ? 'false' : 'true'}</item>
    </style>
</resources>
`)

  return skipped
}

/**
 * `native.android.minSdk` (default 23) into App_Resources/Android/app.gradle,
 * which @nativescript/android applies after its own defaultConfig.
 * NativeScript's own default is 21 (Android 5.0), below what current
 * Google Play services and Firebase libraries require (23).
 */
export function ensureAndroidMinSdk(projectRoot, minSdk = 23) {
  const value = Number(minSdk)
  if (!Number.isInteger(value) || value < 21) {
    throw new Error(`[vastx-native] native.android.minSdk must be an integer of at least 21, got ${JSON.stringify(minSdk)}`)
  }
  ensureMarkedBlock(join(projectRoot, 'App_Resources', 'Android', 'app.gradle'), 'minimum Android version', `
android {
    defaultConfig {
        minSdkVersion ${value}
    }
}
`)
}

function normalizeHex(value, name) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim())
  if (!match) throw new Error(`[vastx-native] native.theme.${name} must be a hex colour like #0B1020, got ${JSON.stringify(value)}`)
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1]
  return `#${hex.toUpperCase()}`
}

/** Relative luminance below the midpoint — WCAG's formula. */
export function isDark(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.179
}
