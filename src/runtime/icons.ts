import { getIconData, iconToSVG } from '@iconify/utils'
import type { IconifyJSON } from '@iconify/types'

export interface ResolveIconSvgOptions {
  /**
   * Replaces `currentColor` in the icon body with this value. Most
   * Iconify sets (confirmed directly in real icon data, e.g. Lucide)
   * use `currentColor` so the icon inherits a CSS `color` on the web —
   * there's no CSS cascade here to resolve that against, so it's
   * swapped for a real color explicitly instead of left unresolved.
   */
  color?: string
  width?: number
  height?: number
}

/**
 * Turns an Iconify icon (looked up from an already-imported icon-set
 * JSON — `import iconSet from '@iconify-json/lucide/icons.json'`, a
 * plain JSON import webpack bundles like any other) into real `<svg>`
 * markup usable as `<NSvg>`'s `src`.
 *
 * Deliberately takes the icon set as a parameter instead of resolving
 * `@iconify-json/<prefix>` by string internally: which set(s) an app
 * installs is its own choice, and a plain static `import` lets webpack
 * bundle only the sets actually used — a dynamic `import()`/`require()`
 * by name would need to be async (icon-set JSON isn't known until
 * runtime) and would bundle every installed set regardless of use.
 *
 * `getIconData`/`iconToSVG` are confirmed real exports of `@iconify/utils`
 * (checked directly against its published dist) — `getIconData` resolves
 * aliases/rotation within the set, `iconToSVG` produces the real
 * `{ attributes: { width?, height?, viewBox }, body }` shape framework
 * integrations (e.g. `@iconify/vue`) build their own `<svg>` wrapper
 * from; `xmlns` isn't part of that output and is added here, the same
 * way those integrations add it themselves.
 */
export function resolveIconSvg(iconSet: IconifyJSON, name: string, options: ResolveIconSvgOptions = {}): string {
  // Memoized per icon set: the same icon is usually rendered many times
  // (every row of a list), and the markup only depends on these inputs.
  let cached = cache.get(iconSet)
  if (!cached) cache.set(iconSet, cached = new Map())
  const key = `${name}|${options.color ?? ''}|${options.width ?? ''}|${options.height ?? ''}`
  const hit = cached.get(key)
  if (hit) return hit

  const svg = buildIconSvg(iconSet, name, options)
  cached.set(key, svg)
  return svg
}

const cache = new WeakMap<IconifyJSON, Map<string, string>>()

function buildIconSvg(iconSet: IconifyJSON, name: string, options: ResolveIconSvgOptions): string {
  const iconData = getIconData(iconSet, name)
  if (!iconData) {
    throw new Error(`[vastx-native] Icon "${name}" was not found in the given icon set.`)
  }

  // Never pass `undefined`: it replaces iconToSVG's own default and makes
  // it throw ("reading 'toString'"), which broke every call without a
  // size. With one size given, iconToSVG derives the other from the
  // icon's aspect ratio; with none, 'auto' = the icon's own size in plain
  // numbers (e.g. 24x24) rather than iconToSVG's default of `1em`, a unit
  // native SVG renderers have no font size to resolve against.
  const size: { width?: number | 'auto', height?: number | 'auto' } = {}
  if (options.width !== undefined) size.width = options.width
  if (options.height !== undefined) size.height = options.height
  if (options.width === undefined && options.height === undefined) size.width = size.height = 'auto'
  const { attributes, body } = iconToSVG(iconData, size)
  const resolvedBody = options.color ? body.replace(/currentColor/g, options.color) : body
  const attrString = Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrString}>${resolvedBody}</svg>`
}
