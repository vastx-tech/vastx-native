import { colors, fontSizes, radii, spacing, type Spacing } from './theme'

/**
 * Typed style objects instead of CSS classes — Flutter's actual mechanism
 * (widgets take typed style objects, not a CSS engine), which NativeScript
 * already supports directly: every N* component's `:style` binding is
 * already a plain JS object, not a CSS string (confirmed by reading every
 * one of them before writing this).
 *
 * Every property this file touches was confirmed real by grepping every
 * `cssName:` registration across `@nativescript/core/ui/` directly (not
 * assumed from documentation, which can drift from what the code actually
 * does — the same discipline this framework's Tailwind support audit
 * used), then reading each property's own real `valueConverter`/enum
 * definition for its exact valid values rather than guessing them. A few
 * properties (`direction`, `background-position`/`background-size`,
 * `text-stroke`) don't have a clean enum in the source and are typed as
 * plain strings — noted individually below.
 *
 * Every function returns a plain style-object fragment, meant to be
 * combined via Vue's own, real, built-in support for binding `:style` to
 * an *array* of objects (merged left to right, confirmed directly by
 * reading nativescript-vue's own renderer/modules/style.js) — no custom
 * merge helper needed:
 *
 *   <NFlex :style="[padding('lg'), bg('surface'), border({ radius: 'md' })]">
 *
 * All exported here are auto-imported (see cli/lib/auto-imports.mjs) —
 * no explicit import needed in a page/component, same as any composable.
 */

export type StyleObject = Record<string, string | number | boolean>
export type ColorInput = keyof typeof colors | (string & {})

// 1rem = 16 device-independent pixels: NativeScript has no root-font-size/
// rem concept of its own (confirmed: nothing in @nativescript/core's CSS
// engine or style-properties resolves a "rem" unit) — this is a
// deliberate convention borrowed from CSS's own long-standing default,
// not a native NativeScript feature, so it's called out explicitly here
// rather than implied.
const REM_TO_DIP = 16

/**
 * A length: a named spacing token (`'md'`), a raw number (device-
 * independent pixels — NativeScript's own native numeric style values are
 * already just DIPs, confirmed via theme.ts's own spacing scale being
 * plain numbers), or a `px`/`rem` string for readability when a design
 * hands you exact values outside the token scale.
 */
export type Length = Spacing | number | `${number}px` | `${number}rem`

/** Exported for components (e.g. NSkeleton) that need a real DIP number to drive imperative native APIs (like View.animate()) rather than a style-object fragment. */
export function resolveLength(value: Length): number {
  if (typeof value === 'number') return value
  if (value in spacing) return spacing[value as Spacing]
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/.exec(value)
  if (remMatch) return Number(remMatch[1]) * REM_TO_DIP
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/.exec(value)
  if (pxMatch) return Number(pxMatch[1])
  throw new Error(`[vastx-native] Invalid length: "${value}" — expected a spacing token, a number, or a "Npx"/"Nrem" string.`)
}

/** Exported for components (e.g. NSkeleton) that need a resolved color string outside a style-object fragment. */
export function resolveColor(input: ColorInput): string {
  return input in colors ? colors[input as keyof typeof colors] : input
}

function hexToRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
  const num = Number.parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => clamp255(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * A translucent version of a color — Flutter's `Color.withOpacity()`.
 * `amount` is 0–1. Only works from a hex input (a token, or a raw `#rrggbb`
 * string); an already-translucent `rgba(...)` input isn't re-parsed.
 * (Confirmed `rgba(...)` strings are genuinely parsed by NativeScript's
 * own Color class, not just hex — see color-utils.js.)
 */
export function opacity(color: ColorInput, amount: number): string {
  const [r, g, b] = hexToRgb(resolveColor(color))
  return `rgba(${r}, ${g}, ${b}, ${amount})`
}

/** A darker version of a color, blended toward black — Flutter's `Color.shade*`. `amount` is 0–1. */
export function shade(color: ColorInput, amount: number): string {
  const [r, g, b] = hexToRgb(resolveColor(color))
  const factor = 1 - amount
  return rgbToHex(r * factor, g * factor, b * factor)
}

/** A lighter version of a color, blended toward white. `amount` is 0–1. */
export function tint(color: ColorInput, amount: number): string {
  const [r, g, b] = hexToRgb(resolveColor(color))
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

// ---------------------------------------------------------------------------
// Box model: padding, margin, size
// ---------------------------------------------------------------------------

export interface SpacingSides {
  all?: Length
  horizontal?: Length
  vertical?: Length
  top?: Length
  right?: Length
  bottom?: Length
  left?: Length
}

function resolveSides(input: Length | SpacingSides, prefix: 'padding' | 'margin'): StyleObject {
  const sides: SpacingSides = typeof input === 'object' ? input : { all: input }
  const top = sides.top ?? sides.vertical ?? sides.all
  const bottom = sides.bottom ?? sides.vertical ?? sides.all
  const left = sides.left ?? sides.horizontal ?? sides.all
  const right = sides.right ?? sides.horizontal ?? sides.all

  const style: StyleObject = {}
  if (top !== undefined) style[`${prefix}Top`] = resolveLength(top)
  if (right !== undefined) style[`${prefix}Right`] = resolveLength(right)
  if (bottom !== undefined) style[`${prefix}Bottom`] = resolveLength(bottom)
  if (left !== undefined) style[`${prefix}Left`] = resolveLength(left)
  return style
}

/** `padding('md')`, `padding(16)`, `padding('1rem')`, or `padding({ horizontal: 'lg', top: 8 })`. */
export function padding(input: Length | SpacingSides): StyleObject {
  return resolveSides(input, 'padding')
}

/** Same shape as `padding()`, for margin. */
export function margin(input: Length | SpacingSides): StyleObject {
  return resolveSides(input, 'margin')
}

export interface SizeInput {
  width?: Length | '100%' | 'auto'
  height?: Length | '100%' | 'auto'
  minWidth?: Length
  minHeight?: Length
  maxWidth?: Length
  maxHeight?: Length
}

function resolveDimension(value: Length | '100%' | 'auto'): string | number {
  return value === '100%' || value === 'auto' ? value : resolveLength(value)
}

/**
 * Dimensions. `'100%'`/`'auto'` pass through as-is — NativeScript's
 * PercentLength/CoreTypes accept those literally (confirmed against
 * @nativescript/core's own CoreTypes) — everything else resolves through
 * the same token/px/rem rules as padding/margin.
 */
export function size(input: SizeInput): StyleObject {
  const style: StyleObject = {}
  if (input.width !== undefined) style.width = resolveDimension(input.width)
  if (input.height !== undefined) style.height = resolveDimension(input.height)
  if (input.minWidth !== undefined) style.minWidth = resolveLength(input.minWidth)
  if (input.minHeight !== undefined) style.minHeight = resolveLength(input.minHeight)
  if (input.maxWidth !== undefined) style.maxWidth = resolveLength(input.maxWidth)
  if (input.maxHeight !== undefined) style.maxHeight = resolveLength(input.maxHeight)
  return style
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

export interface BackgroundInput {
  color?: ColorInput
  /** A real, parsed CSS value — `url(...)`, or `linear-gradient(...)` (confirmed real, linear only — see ARCHITECTURE.md). */
  image?: string
  /** Confirmed real values (background.ios.js's own switch on this). */
  repeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y'
  /** Not cleanly enumerated in source — a real CSS background-position value string (e.g. `'center'`, `'50% 50%'`). */
  position?: string
  /** Not cleanly enumerated in source — a real CSS background-size value string (e.g. `'cover'`, `'contain'`). */
  size?: string
}

/** `bg('primary')` (just a color) or `bg({ color, image, repeat, position, size })` for the full background shorthand. */
export function bg(input: ColorInput | BackgroundInput): StyleObject {
  if (typeof input === 'string') return { backgroundColor: resolveColor(input) }
  const style: StyleObject = {}
  if (input.color !== undefined) style.backgroundColor = resolveColor(input.color)
  if (input.image !== undefined) style.backgroundImage = input.image
  if (input.repeat !== undefined) style.backgroundRepeat = input.repeat
  if (input.position !== undefined) style.backgroundPosition = input.position
  if (input.size !== undefined) style.backgroundSize = input.size
  return style
}

// ---------------------------------------------------------------------------
// Border, corners, shadow — the simple, common-case container styling
// (same shape NCard builds internally); see border() below for per-side/
// per-corner control.
// ---------------------------------------------------------------------------

export interface BoxStyleInput {
  radius?: keyof typeof radii | Length
  background?: ColorInput
  elevated?: boolean
  borderColor?: ColorInput
  borderWidth?: Length
  /** The view's own alpha (0–1) — distinct from the opacity()/shade()/tint() color functions above. */
  opacity?: number
  /** A real CSS clip-path shape string (e.g. `'circle(50%)'`) — NativeScript has no `overflow` property at all, only this. */
  clipPath?: string
}

export function box(input: BoxStyleInput = {}): StyleObject {
  const style: StyleObject = {}
  if (input.radius !== undefined) {
    style.borderRadius = typeof input.radius === 'string' && input.radius in radii
      ? radii[input.radius as keyof typeof radii]
      : resolveLength(input.radius as Length)
  }
  if (input.background !== undefined) style.backgroundColor = resolveColor(input.background)
  // Same real box-shadow CSS string NCard uses — see its own comment on
  // why this is left as one fixed elevation rather than a numeric scale.
  if (input.elevated) style.boxShadow = '0 1 3 rgba(15, 23, 42, 0.12)'
  if (input.borderWidth !== undefined) style.borderWidth = resolveLength(input.borderWidth)
  if (input.borderColor !== undefined) style.borderColor = resolveColor(input.borderColor)
  if (input.opacity !== undefined) style.opacity = input.opacity
  if (input.clipPath !== undefined) style.clipPath = input.clipPath
  return style
}

export interface BorderSides {
  all?: Length
  top?: Length
  right?: Length
  bottom?: Length
  left?: Length
}

export interface BorderColorSides {
  all?: ColorInput
  top?: ColorInput
  right?: ColorInput
  bottom?: ColorInput
  left?: ColorInput
}

export interface RadiusCorners {
  all?: keyof typeof radii | Length
  topLeft?: keyof typeof radii | Length
  topRight?: keyof typeof radii | Length
  bottomLeft?: keyof typeof radii | Length
  bottomRight?: keyof typeof radii | Length
}

function resolveRadiusValue(value: keyof typeof radii | Length): number {
  return typeof value === 'string' && value in radii ? radii[value as keyof typeof radii] : resolveLength(value as Length)
}

export interface BorderInput {
  width?: Length | BorderSides
  color?: ColorInput | BorderColorSides
  radius?: keyof typeof radii | Length | RadiusCorners
  /** `'round'` (default) or `'squircle'` — confirmed real, CoreTypes.CornerShape's only two values. */
  cornerShape?: 'round' | 'squircle'
}

/**
 * Per-side border width/color and per-corner radius — `box()`'s simple,
 * single-value border/radius covers the common case; reach for this when
 * you need each side/corner to differ.
 */
export function border(input: BorderInput): StyleObject {
  const style: StyleObject = {}

  if (input.width !== undefined) {
    if (typeof input.width === 'object') {
      const w = input.width
      if (w.top !== undefined) style.borderTopWidth = resolveLength(w.top)
      if (w.right !== undefined) style.borderRightWidth = resolveLength(w.right)
      if (w.bottom !== undefined) style.borderBottomWidth = resolveLength(w.bottom)
      if (w.left !== undefined) style.borderLeftWidth = resolveLength(w.left)
      if (w.all !== undefined) style.borderWidth = resolveLength(w.all)
    } else {
      style.borderWidth = resolveLength(input.width)
    }
  }

  if (input.color !== undefined) {
    if (typeof input.color === 'object') {
      const c = input.color
      if (c.top !== undefined) style.borderTopColor = resolveColor(c.top)
      if (c.right !== undefined) style.borderRightColor = resolveColor(c.right)
      if (c.bottom !== undefined) style.borderBottomColor = resolveColor(c.bottom)
      if (c.left !== undefined) style.borderLeftColor = resolveColor(c.left)
      if (c.all !== undefined) style.borderColor = resolveColor(c.all)
    } else {
      style.borderColor = resolveColor(input.color)
    }
  }

  if (input.radius !== undefined) {
    if (typeof input.radius === 'object') {
      const r = input.radius
      if (r.topLeft !== undefined) style.borderTopLeftRadius = resolveRadiusValue(r.topLeft)
      if (r.topRight !== undefined) style.borderTopRightRadius = resolveRadiusValue(r.topRight)
      if (r.bottomLeft !== undefined) style.borderBottomLeftRadius = resolveRadiusValue(r.bottomLeft)
      if (r.bottomRight !== undefined) style.borderBottomRightRadius = resolveRadiusValue(r.bottomRight)
      if (r.all !== undefined) style.borderRadius = resolveRadiusValue(r.all)
    } else {
      style.borderRadius = resolveRadiusValue(input.radius)
    }
  }

  if (input.cornerShape !== undefined) style.cornerShape = input.cornerShape

  return style
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export interface TextStyleInput {
  size?: keyof typeof fontSizes | Length
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: ColorInput
  align?: 'left' | 'center' | 'right' | 'justify'
  family?: string
  style?: 'normal' | 'italic'
  /** Real, confirmed NativeScript TextDecoration values. */
  decoration?: 'none' | 'underline' | 'line-through' | 'underline line-through'
  /** Real, confirmed NativeScript TextTransform values. */
  transform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase'
  letterSpacing?: number
  lineHeight?: Length
  /** Real, confirmed NativeScript WhiteSpace values — 'wrap' is an NS-specific addition alongside the standard two. */
  whiteSpace?: 'normal' | 'nowrap' | 'wrap'
  /** Requires whiteSpace: 'nowrap' to have a visible effect (matches real CSS text-overflow semantics). */
  overflow?: 'clip' | 'ellipsis'
  /** NativeScript-specific (not real CSS) — caps the number of lines regardless of whiteSpace/overflow. */
  maxLines?: number
  /** A real CSS text-shadow string (e.g. `'1 1 2 rgba(0,0,0,0.3)'`). */
  shadow?: string
  /** Real CSS text-stroke (confirmed via css-stroke.js's own shorthand parser: `"<width> <color>"`). */
  stroke?: { width: Length; color: ColorInput }
  /**
   * Real, confirmed `font-variation-settings` (variable-font axes, e.g.
   * `'"wght" 600'`) — iOS only (affectsLayout is Apple-only in the
   * source). Left as a raw string: the source's own value has no clean
   * enum, just axis/value pairs.
   */
  variationSettings?: string
}

const fontWeights = { normal: '400', medium: '500', semibold: '600', bold: '700' } as const

/** Text styling — mirrors NText's own variant logic, as a composable fragment instead of a component prop. */
export function textStyle(input: TextStyleInput): StyleObject {
  const style: StyleObject = {}
  if (input.size !== undefined) {
    style.fontSize = typeof input.size === 'string' && input.size in fontSizes
      ? fontSizes[input.size as keyof typeof fontSizes]
      : resolveLength(input.size as Length)
  }
  if (input.weight !== undefined) style.fontWeight = fontWeights[input.weight]
  if (input.color !== undefined) style.color = resolveColor(input.color)
  if (input.align !== undefined) style.textAlignment = input.align
  if (input.family !== undefined) style.fontFamily = input.family
  if (input.style !== undefined) style.fontStyle = input.style
  if (input.decoration !== undefined) style.textDecoration = input.decoration
  if (input.transform !== undefined) style.textTransform = input.transform
  if (input.letterSpacing !== undefined) style.letterSpacing = input.letterSpacing
  if (input.lineHeight !== undefined) style.lineHeight = resolveLength(input.lineHeight)
  if (input.whiteSpace !== undefined) style.whiteSpace = input.whiteSpace
  if (input.overflow !== undefined) style.textOverflow = input.overflow
  if (input.maxLines !== undefined) style.maxLines = input.maxLines
  if (input.shadow !== undefined) style.textShadow = input.shadow
  if (input.stroke !== undefined) style.textStroke = `${resolveLength(input.stroke.width)} ${resolveColor(input.stroke.color)}`
  if (input.variationSettings !== undefined) style.fontVariationSettings = input.variationSettings
  return style
}

// ---------------------------------------------------------------------------
// Flexbox — only takes effect on a real flex container (<NFlex>/
// <FlexboxLayout>), same as flexbox only does anything on a real flex
// container on the web. grow/shrink/order/alignSelf apply to a flex
// *item* (a child of the container), not the container itself.
// ---------------------------------------------------------------------------

export interface FlexInput {
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
  /** Confirmed real values — NativeScript's flexbox does NOT support 'space-evenly' (only the CSS Flexbox Level 1 subset). */
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around'
  align?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch'
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'stretch'
  /** Confirmed broken on Android: a non-zero row-gap silently drops a <FlexboxLayout>'s last child from the native view tree entirely (a real bug in NativeScript's own compiled org.nativescript.widgets.FlexboxLayout, not this framework's translation of it — the same reason Tailwind's gap-* is disabled framework-wide). Use per-child margin for spacing instead. */
  gap?: Length
  rowGap?: Length
  columnGap?: Length
  /** Flex item properties — set on the child, not the <NFlex> container itself. */
  grow?: number
  shrink?: number
  /** Same values as `align`, plus `'auto'` (inherit the container's `align`) — a flex item's own override. */
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch'
  order?: number
  /** Confirmed real (FlexWrapBefore.parse) — forces the container to wrap onto a new line/column before this item. */
  wrapBefore?: boolean
}

/** Flexbox container/item properties — the same real, confirmed-supported set NFlex/Tailwind's flex utilities target. */
export function flex(input: FlexInput): StyleObject {
  const style: StyleObject = {}
  if (input.direction !== undefined) style.flexDirection = input.direction
  if (input.wrap !== undefined) style.flexWrap = input.wrap
  if (input.justify !== undefined) style.justifyContent = input.justify
  if (input.align !== undefined) style.alignItems = input.align
  if (input.alignContent !== undefined) style.alignContent = input.alignContent
  if (input.gap !== undefined) style.gap = resolveLength(input.gap)
  if (input.rowGap !== undefined) style.rowGap = resolveLength(input.rowGap)
  if (input.columnGap !== undefined) style.columnGap = resolveLength(input.columnGap)
  if (input.grow !== undefined) style.flexGrow = input.grow
  if (input.shrink !== undefined) style.flexShrink = input.shrink
  if (input.alignSelf !== undefined) style.alignSelf = input.alignSelf
  if (input.order !== undefined) style.order = input.order
  if (input.wrapBefore !== undefined) style.flexWrapBefore = input.wrapBefore
  return style
}

// ---------------------------------------------------------------------------
// Transform — real, literal-number values (confirmed against
// convertToTransform in style-properties.js): unlike Tailwind's
// transform utilities (which compose from CSS custom properties
// NativeScript's parser doesn't understand — see ARCHITECTURE.md), these
// pass real numbers directly, so they work correctly.
// ---------------------------------------------------------------------------

export interface TransformInput {
  rotate?: number
  rotateX?: number
  rotateY?: number
  scaleX?: number
  scaleY?: number
  translateX?: Length
  translateY?: Length
  /** iOS-only (affectsLayout is Apple-only in the source) — a 3D perspective distance in DIPs. */
  perspective?: number
}

export function transform(input: TransformInput): StyleObject {
  const style: StyleObject = {}
  if (input.rotate !== undefined) style.rotate = input.rotate
  if (input.rotateX !== undefined) style.rotateX = input.rotateX
  if (input.rotateY !== undefined) style.rotateY = input.rotateY
  if (input.scaleX !== undefined) style.scaleX = input.scaleX
  if (input.scaleY !== undefined) style.scaleY = input.scaleY
  if (input.translateX !== undefined) style.translateX = resolveLength(input.translateX)
  if (input.translateY !== undefined) style.translateY = resolveLength(input.translateY)
  if (input.perspective !== undefined) style.perspective = input.perspective
  return style
}

// ---------------------------------------------------------------------------
// A view's own position within its parent layout — a different concept
// from flex's align-items/justify-content (those position children of a
// flex container; this positions any view within whatever container it's
// actually in, e.g. a GridLayout cell).
// ---------------------------------------------------------------------------

export interface AlignInput {
  /** Confirmed real values (CoreTypes.HorizontalAlignment) — includes logical 'start'/'end', not just left/right. */
  horizontal?: 'start' | 'left' | 'center' | 'right' | 'end' | 'stretch'
  /** Confirmed real values (CoreTypes.VerticalAlignmentText) — includes text-relative baseline/sup/sub values, not just top/middle/bottom. */
  vertical?: 'top' | 'middle' | 'bottom' | 'stretch' | 'text-top' | 'text-bottom' | 'sup' | 'sub' | 'baseline'
}

export function align(input: AlignInput): StyleObject {
  const style: StyleObject = {}
  if (input.horizontal !== undefined) style.horizontalAlignment = input.horizontal
  if (input.vertical !== undefined) style.verticalAlignment = input.vertical
  return style
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** `visible('collapse')` fully removes the view from layout; `'hidden'` keeps its space reserved but invisible. */
export function visible(value: 'visible' | 'hidden' | 'collapse' | 'collapsed'): StyleObject {
  return { visibility: value }
}

export function zIndex(value: number): StyleObject {
  return { zIndex: value }
}

/** Android-only real Material elevation shadow (android-elevation/android-dynamic-elevation-offset). No iOS equivalent — use box({ elevated: true }) for a cross-platform shadow instead. */
export function elevation(value: number, dynamicOffset?: number): StyleObject {
  const style: StyleObject = { androidElevation: value }
  if (dynamicOffset !== undefined) style.androidDynamicElevationOffset = dynamicOffset
  return style
}

/** iOS-only (affectsLayout is Apple-only in the source) — text/layout direction. */
export function direction(value: 'ltr' | 'rtl'): StyleObject {
  return { direction: value }
}

/**
 * A view's tint color — confirmed real, a genuine inherited `Style`
 * property (tintColorProperty.register(Style) in image-common.js, despite
 * living in that file), not just an Image-only property: real, native use
 * includes NSwitch's on-tint on iOS.
 */
export function tintColor(color: ColorInput): StyleObject {
  return { tintColor: resolveColor(color) }
}

/** Placeholder text color for NInput's underlying TextField/TextView (confirmed: editable-text-base-common.js's own placeholderColorProperty). */
export function placeholder(color: ColorInput): StyleObject {
  return { placeholderColor: resolveColor(color) }
}
