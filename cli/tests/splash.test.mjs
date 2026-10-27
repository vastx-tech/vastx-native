import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { applySplashBranding } from '../lib/splash.mjs'

// Decodes the PNGs this project's own encoder writes: 8-bit RGBA, filter 0 on every row.
function decode(path) {
  const png = readFileSync(path)
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const idat = []
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at)
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length))
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(idat))
  const pixel = (x, y) => {
    const i = y * (width * 4 + 1) + 1 + x * 4
    return [...raw.subarray(i, i + 4)]
  }
  return { width, height, pixel }
}

function brand(platforms) {
  const dir = mkdtempSync(join(tmpdir(), 'vastx-splash-'))
  applySplashBranding(dir, platforms)
  return dir
}

test('splash and launcher images keep the template pixel sizes', (t) => {
  const dir = brand(['android', 'ios'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const android = join(dir, 'Android/src/main/res')
  const ios = join(dir, 'iOS/Assets.xcassets')
  const expected = [
    [join(android, 'drawable-mdpi/background.png'), 360, 592],
    [join(android, 'drawable-xxxhdpi/logo.png'), 800, 156],
    [join(android, 'drawable-xxxhdpi/icon.png'), 192, 192],
    [join(ios, 'LaunchScreen.AspectFill.imageset/LaunchScreen-AspectFill@3x.png'), 2304, 3072],
    [join(ios, 'LaunchScreen.Center.imageset/LaunchScreen-Center@3x.png'), 1170, 222]
  ]
  for (const [path, width, height] of expected) {
    const png = decode(path)
    assert.deepEqual([png.width, png.height], [width, height], path)
  }
})

test('the launcher icon draws the orbit mark on brand navy', (t) => {
  const dir = brand(['android'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const icon = decode(join(dir, 'Android/src/main/res/drawable-xxxhdpi/icon.png'))

  assert.deepEqual(icon.pixel(2, 2), [11, 16, 32, 255])
  assert.deepEqual(icon.pixel(96, 96), [11, 16, 32, 255], 'the space inside the orbit is empty')
  const found = { core: false, planet: false, ring: false }
  for (let y = 0; y < icon.height; y++) {
    for (let x = 0; x < icon.width; x++) {
      const [r, g, b, a] = icon.pixel(x, y)
      if (a !== 255) continue
      if (g > 200 && b > 230 && r < 150) found.core = true
      if (r > 220 && b > 220 && g < 190) found.planet = true
      if (b > 200 && r > 130 && g < 110) found.ring = true
    }
  }
  assert.deepEqual(found, { core: true, planet: true, ring: true })
})

test('the splash logo layer is transparent outside the mark', (t) => {
  const dir = brand(['ios'])
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const logo = decode(join(dir, 'iOS/Assets.xcassets/LaunchScreen.Center.imageset/LaunchScreen-Center@3x.png'))
  assert.equal(logo.pixel(5, 5)[3], 0)
  assert.equal(logo.pixel(logo.width - 5, logo.height / 2)[3], 0)
})
