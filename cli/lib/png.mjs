import { crc32, deflateSync } from 'node:zlib'

/**
 * Minimal, dependency-free PNG encoder plus a rasterizer for the VastX Native
 * mark — enough to generate branded splash screens and launcher icons without
 * a canvas library. The mark is built from circle arcs, so it can be drawn
 * exactly from geometry rather than shipped as image files.
 */

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput) >>> 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

/** Encodes a raw RGBA pixel buffer (width*height*4 bytes) as a PNG file. */
export function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type: RGBA
  // bytes 10-12 (compression/filter/interlace) already zero
  const ihdr = chunk('IHDR', ihdrData)

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // per-scanline filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = chunk('IDAT', deflateSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

/** Allocates a width*height RGBA canvas filled with `color`. */
export function createCanvas(width, height, color = [0, 0, 0, 0]) {
  const buf = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) setPixelIndex(buf, i, color)
  return buf
}

function setPixelIndex(buf, index, [r, g, b, a = 255]) {
  buf[index * 4] = r
  buf[index * 4 + 1] = g
  buf[index * 4 + 2] = b
  buf[index * 4 + 3] = a
}

// The mark (branding/vastx-native-mark.svg), in its 128-unit design box: a core
// and three rings of radius 13 · 21 · 34 · 55, all touching at one origin point.
// Each ring is radius ÷ φ⁴ thick on the far side and tapers into the origin; a
// planet of radius core ÷ φ sits on the outer ring at the golden angle.
const PHI = (1 + Math.sqrt(5)) / 2
const CENTRE = [64, 64]
const OUTER = 55
const AXIS = [Math.SQRT1_2, -Math.SQRT1_2]
const ORIGIN = [CENTRE[0] - OUTER * AXIS[0], CENTRE[1] - OUTER * AXIS[1]]
const along = d => [ORIGIN[0] + d * AXIS[0], ORIGIN[1] + d * AXIS[1]]
const CORE_R = 13
const CORE_C = along(CORE_R)
const PLANET_R = CORE_R / PHI
const GAP = PLANET_R / PHI ** 2
const thickness = R => R / PHI ** 4

function ring(R, tMax) {
  const tMin = tMax / PHI ** 3
  const ri = (2 * R - tMin - tMax) / 2
  return { co: along(R), R, ci: along(tMin + ri), ri }
}
const RINGS = [21, 34, 55].map(R => ring(R, thickness(R)))
const SIMPLE_RINGS = [ring(OUTER, thickness(OUTER) * 1.45)]

// Planet centre: on the outer band's mid-line, 137.5° round the ring from the origin.
const PLANET_C = (() => {
  const outer = RINGS[2]
  const a = Math.atan2(ORIGIN[1] - CENTRE[1], ORIGIN[0] - CENTRE[0]) + (2 * Math.PI) / PHI ** 2
  const dir = [Math.cos(a), Math.sin(a)]
  const f = [CENTRE[0] - outer.ci[0], CENTRE[1] - outer.ci[1]]
  const b = 2 * (f[0] * dir[0] + f[1] * dir[1])
  const t = (-b + Math.sqrt(b * b - 4 * (f[0] ** 2 + f[1] ** 2 - outer.ri ** 2))) / 2
  return [CENTRE[0] + ((OUTER + t) / 2) * dir[0], CENTRE[1] + ((OUTER + t) / 2) * dir[1]]
})()

const MARK_BOX = {
  x1: Math.min(CENTRE[0] - OUTER, PLANET_C[0] - PLANET_R),
  y1: Math.min(CENTRE[1] - OUTER, PLANET_C[1] - PLANET_R),
  x2: Math.max(CENTRE[0] + OUTER, PLANET_C[0] + PLANET_R),
  y2: Math.max(CENTRE[1] + OUTER, PLANET_C[1] + PLANET_R)
}
export const MARK_ASPECT = (MARK_BOX.x2 - MARK_BOX.x1) / (MARK_BOX.y2 - MARK_BOX.y1)

const RING_STOPS = [[0, [34, 211, 238]], [0.5, [99, 102, 241]], [1, [168, 85, 247]]]
const CORE_STOPS = [[0, [240, 253, 255]], [0.45, [103, 232, 249]], [1, [37, 99, 235]]]
const PLANET_STOPS = [[0, [253, 244, 255]], [0.5, [240, 171, 252]], [1, [192, 38, 211]]]

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

function lerpStops(stops, t) {
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]
    if (x <= t1) {
      const [t0, c0] = stops[i - 1]
      const k = (x - t0) / (t1 - t0)
      return c0.map((v, j) => v + (c1[j] - v) * k)
    }
  }
  return stops[stops.length - 1][1]
}

// A lit sphere: the same radial gradient as the SVG (focus at 38%/34% of the circle's box).
function sphere(p, c, rad, stops, reach) {
  const focus = [c[0] - rad + 0.76 * rad, c[1] - rad + 0.68 * rad]
  return lerpStops(stops, dist(p, focus) / (reach * 2 * rad))
}

function markSample(p, simple) {
  if (dist(p, PLANET_C) <= PLANET_R) return sphere(p, PLANET_C, PLANET_R, PLANET_STOPS, 0.75)
  if (dist(p, CORE_C) <= CORE_R) return sphere(p, CORE_C, CORE_R, CORE_STOPS, 0.72)
  if (dist(p, PLANET_C) < PLANET_R + GAP || dist(p, CORE_C) < CORE_R + GAP) return null
  for (const g of simple ? SIMPLE_RINGS : RINGS) {
    if (dist(p, g.co) <= g.R && dist(p, g.ci) > g.ri) {
      const t = ((p[0] - ORIGIN[0]) * AXIS[0] + (p[1] - ORIGIN[1]) * AXIS[1]) / (OUTER * 2)
      return lerpStops(RING_STOPS, t)
    }
  }
  return null
}

/**
 * Draws the mark centred on (cx, cy), `markWidth` pixels wide, alpha-blended
 * over whatever the canvas already holds. `simple` draws the small-size version
 * (core, outer ring and planet). 4×4 supersampling per pixel.
 */
export function drawMark(buf, width, height, { cx, cy, markWidth, simple = false }) {
  const scale = markWidth / (MARK_BOX.x2 - MARK_BOX.x1)
  const markHeight = (MARK_BOX.y2 - MARK_BOX.y1) * scale
  const left = cx - markWidth / 2
  const top = cy - markHeight / 2
  const toMark = (x, y) => [MARK_BOX.x1 + (x - left) / scale, MARK_BOX.y1 + (y - top) / scale]
  const SS = 4
  const minX = Math.max(0, Math.floor(cx - markWidth / 2) - 1)
  const maxX = Math.min(width - 1, Math.ceil(cx + markWidth / 2) + 1)
  const minY = Math.max(0, Math.floor(cy - markHeight / 2) - 1)
  const maxY = Math.min(height - 1, Math.ceil(cy + markHeight / 2) + 1)

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      let hits = 0
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = markSample(toMark(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS), simple)
          if (!color) continue
          hits++
          for (let i = 0; i < 3; i++) sum[i] += color[i]
        }
      }
      if (!hits) continue
      const a = hits / (SS * SS)
      const i = (py * width + px) * 4
      const dstA = buf[i + 3] / 255
      const outA = a + dstA * (1 - a)
      for (let k = 0; k < 3; k++) {
        buf[i + k] = Math.round(((sum[k] / hits) * a + buf[i + k] * dstA * (1 - a)) / outA)
      }
      buf[i + 3] = Math.round(outA * 255)
    }
  }
}
