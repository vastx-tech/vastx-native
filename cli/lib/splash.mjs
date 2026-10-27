import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createCanvas, drawNGlyph, encodePng, fillCircle } from './png.mjs'

// A deep indigo, deliberately distinct from Nuxt's own brand green (this is
// a third-party framework, not an official Nuxt project) and from
// NativeScript's default template blue/white — so a fresh install reads as
// "VastX Native," not as either of the frameworks it's built from.
const BRAND_BACKGROUND = [49, 46, 129, 255] // indigo-900
const BRAND_FOREGROUND = [255, 255, 255, 255]

// Exact pixel dimensions of the files `ns platform add` generates from
// NativeScript's own project template (@nativescript/template-hello-world-ts)
// — read directly from that template's PNG headers so these replacements
// don't shift layout or blur at any density/scale NativeScript itself uses.
const ANDROID_BACKGROUND_SIZES = {
  ldpi: [270, 444],
  mdpi: [360, 592],
  hdpi: [540, 888],
  xhdpi: [720, 1184],
  xxhdpi: [1080, 1776],
  xxxhdpi: [1440, 2368]
}

const ANDROID_LOGO_SIZES = {
  ldpi: [150, 29],
  mdpi: [200, 39],
  hdpi: [300, 58],
  xhdpi: [400, 78],
  xxhdpi: [600, 117],
  xxxhdpi: [800, 156]
}

// Real launcher-icon pixel sizes per density (read from ic_launcher.png's
// own headers in @nativescript/template-hello-world-ts@9.1.1 and 8.1.1 —
// standard Android launcher sizes, unchanged across that range). No ldpi
// entry: neither template version ships one for the launcher icon (unlike
// the splash background/logo above, which do).
const ANDROID_LAUNCHER_ICON_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192
}

const IOS_BACKGROUND_SIZES = {
  'LaunchScreen-AspectFill.png': [768, 1024],
  'LaunchScreen-AspectFill@2x.png': [1536, 2048],
  'LaunchScreen-AspectFill@3x.png': [2304, 3072]
}

const IOS_LOGO_SIZES = {
  'LaunchScreen-Center.png': [390, 74],
  'LaunchScreen-Center@2x.png': [780, 148],
  'LaunchScreen-Center@3x.png': [1170, 222]
}

/**
 * Overwrites just the splash-screen images inside an already-scaffolded
 * App_Resources (from `ns platform add`) with vastx-native's own branding,
 * instead of NativeScript's default wordmark-on-white. Everything else in
 * App_Resources (manifests, icons, Info.plist, Gradle files, ...) is left
 * untouched — deliberately narrow, matching the same reasoning as not
 * hand-generating App_Resources itself: only touch the specific files this
 * needs to, and let NativeScript's own template keep owning the rest.
 *
 * Only brands the platforms actually passed — `ns platform add` populates
 * Android/iOS as separate subtrees of the same App_Resources, so branding
 * a platform that was never added would just create a stray, orphaned
 * directory tree for it.
 */
export function applySplashBranding(appResourcesPath, platforms) {
  if (platforms.includes('android')) {
    const androidRes = join(appResourcesPath, 'Android/src/main/res')
    for (const [density, [width, height]] of Object.entries(ANDROID_BACKGROUND_SIZES)) {
      writePng(join(androidRes, `drawable-${density}/background.png`), renderBackground(width, height))
    }
    for (const [density, [width, height]] of Object.entries(ANDROID_LOGO_SIZES)) {
      writePng(join(androidRes, `drawable-${density}/logo.png`), renderLogoBadge(width, height))
    }
    ensureAndroidLauncherIconFallback(androidRes)
  }

  if (platforms.includes('ios')) {
    const iosImageAssets = join(appResourcesPath, 'iOS/Assets.xcassets')
    for (const [filename, [width, height]] of Object.entries(IOS_BACKGROUND_SIZES)) {
      writePng(join(iosImageAssets, 'LaunchScreen.AspectFill.imageset', filename), renderBackground(width, height))
    }
    for (const [filename, [width, height]] of Object.entries(IOS_LOGO_SIZES)) {
      writePng(join(iosImageAssets, 'LaunchScreen.Center.imageset', filename), renderLogoBadge(width, height))
    }
  }
}

/**
 * `vastx-native init` never runs `ns create` — it calls `ns platform add
 * android` directly against a project with no App_Resources at all (see
 * `init.mjs`). Reading the real CLI's source
 * (`android-project-service.js`'s `ensureConfigurationFileInAppResources`)
 * confirms it only *warns* "No manifest found" and moves on when a
 * project supplies none — it never synthesizes one from
 * `@nativescript/template-hello-world-ts` or any other up-to-date
 * template, only `ns create` does that. So a from-scratch `platform add`
 * falls back to whatever AndroidManifest.xml `@nativescript/android`'s own
 * runtime bundles internally, and that can be out of sync with the
 * modern adaptive-icon convention (`android:icon="@mipmap/ic_launcher"`,
 * confirmed current in both hello-world-ts@9.1.1 and 8.1.1) — reproduced
 * by a real user's Gradle failure: "resource drawable/icon ... not
 * found", meaning their resolved fallback manifest still points at the
 * older `@drawable/icon` convention, and nothing at that path exists.
 *
 * Fix is deliberately additive, not a manifest edit: this project already
 * avoids hand-touching NativeScript's own generated AndroidManifest.xml
 * (see ARCHITECTURE.md's `init` row) — instead this just makes sure
 * a `drawable` density variant of `icon.png` exists too, alongside
 * whatever `mipmap` density variant of `ic_launcher.png` the runtime
 * already produced, so the app resolves correctly under either manifest
 * convention. An unreferenced drawable is inert, so this is safe to run
 * unconditionally on every init.
 */
function ensureAndroidLauncherIconFallback(androidRes) {
  for (const [density, size] of Object.entries(ANDROID_LAUNCHER_ICON_SIZES)) {
    const iconPath = join(androidRes, `drawable-${density}/icon.png`)
    if (existsSync(iconPath)) {
      continue
    }
    writePng(iconPath, renderLauncherIcon(size, size))
  }
}

/** Same badge mark as the splash logo, opaque and square — a launcher icon
 * has no separate background layer to composite onto like the splash
 * screen does. */
function renderLauncherIcon(width, height) {
  const buf = createCanvas(width, height, BRAND_BACKGROUND)
  const cx = width / 2
  const cy = height / 2
  const diameter = Math.min(width, height) * 0.85
  fillCircle(buf, width, height, cx, cy, diameter / 2, BRAND_FOREGROUND)

  const glyphHeight = diameter * 0.5
  const glyphWidth = glyphHeight * 0.72
  drawNGlyph(
    buf,
    width,
    height,
    { x: cx - glyphWidth / 2, y: cy - glyphHeight / 2, width: glyphWidth, height: glyphHeight },
    BRAND_BACKGROUND
  )

  return encodePng(width, height, buf)
}

function renderBackground(width, height) {
  return encodePng(width, height, createCanvas(width, height, BRAND_BACKGROUND))
}

/** A centered circular badge with a simple "N" mark, on transparent — the
 * logo layer sits on top of the (opaque) background layer in both
 * NativeScript's Android layer-list and its iOS storyboard. */
function renderLogoBadge(width, height) {
  const buf = createCanvas(width, height, [0, 0, 0, 0])
  const cx = width / 2
  const cy = height / 2
  const diameter = height * 0.9
  fillCircle(buf, width, height, cx, cy, diameter / 2, BRAND_FOREGROUND)

  const glyphHeight = diameter * 0.5
  const glyphWidth = glyphHeight * 0.72
  drawNGlyph(
    buf,
    width,
    height,
    { x: cx - glyphWidth / 2, y: cy - glyphHeight / 2, width: glyphWidth, height: glyphHeight },
    BRAND_BACKGROUND
  )

  return encodePng(width, height, buf)
}

function writePng(path, pngBuffer) {
  if (!existsSync(dirname(path))) {
    // The imageset/drawable-* directory should already exist from `ns
    // platform add`; only create it if this runs against an App_Resources
    // laid out differently than expected, rather than silently no-op-ing.
    mkdirSync(dirname(path), { recursive: true })
  }
  writeFileSync(path, pngBuffer)
}
