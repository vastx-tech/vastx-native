import { isAndroid, Utils } from '@nativescript/core'
import type { EventData, View } from '@nativescript/core'
import type { Directive } from 'vue'

/**
 * Why this exists: NativeScript's @tap on a plain view (a layout, a Label,
 * a card) counts a quick second tap as a double tap on Android and drops
 * it. Core's TapAndDoubleTapGestureListener (ui/gestures/index.android.js)
 * extends SimpleOnGestureListener, so Android's GestureDetector also
 * installs it as its double-tap listener, and a second tap inside the
 * double-tap timeout (~300 ms) never reaches onSingleTapUp — the only
 * place core fires `tap`. Measured on a device: 5 quick double taps
 * counted 5 of 10. A native <Button> uses a click listener instead and
 * counts every tap; this gives any view the same.
 *
 * iOS doesn't need it (UIKit's single-tap recognizer fires every tap), so
 * there the plain `tap` event is used.
 */

export interface NativeClickOptions {
  /** ARGB ripple colour, or false for none. Default: a neutral 12% black. */
  rippleColor?: number | false
  /** Corner radius for the ripple, in DIPs. Default: the view's own top-left border radius. */
  cornerRadius?: number
}

/**
 * Android only. Sets a native View.OnClickListener (and a ripple foreground)
 * on the view now and again on every `loaded`, since NativeScript can
 * recreate a view's native counterpart. Returns a function that removes it.
 */
export function attachNativeClick(view: View, onClick: () => void, options: NativeClickOptions = {}): () => void {
  // Held for as long as the view uses it, so the Java proxy isn't collected.
  const listener = new android.view.View.OnClickListener({ onClick: () => onClick() })

  const apply = () => {
    const nativeView = view.nativeViewProtected as android.view.View | undefined
    if (!nativeView) return
    nativeView.setOnClickListener(listener)
    if (options.rippleColor !== false) nativeView.setForeground(ripple(view, options))
  }
  const onLoaded = (_args: EventData) => apply()

  view.on('loaded', onLoaded)
  if (view.isLoaded) apply()

  return () => {
    view.off('loaded', onLoaded)
    const nativeView = view.nativeViewProtected as android.view.View | undefined
    nativeView?.setOnClickListener(null)
    // Android accepts null here (it clears the ripple); the SDK typings mark the parameter non-null.
    if (options.rippleColor !== false) nativeView?.setForeground(null as unknown as android.graphics.drawable.Drawable)
  }
}

function ripple(view: View, { rippleColor = 0x1F000000, cornerRadius }: NativeClickOptions) {
  const radius = cornerRadius ?? lengthInDips(view.style.borderTopLeftRadius)
  const mask = new android.graphics.drawable.GradientDrawable()
  mask.setColor(0xFFFFFFFF | 0)
  mask.setCornerRadius(Utils.layout.toDevicePixels(radius))
  return new android.graphics.drawable.RippleDrawable(
    android.content.res.ColorStateList.valueOf((rippleColor as number) | 0),
    null,
    mask
  )
}

function lengthInDips(length: unknown): number {
  if (typeof length === 'number') return length
  if (length && typeof length === 'object' && 'value' in length) {
    const { value, unit } = length as { value: number, unit?: string }
    return unit === 'px' ? Utils.layout.toDeviceIndependentPixels(value) : value
  }
  return 0
}

type TapHandler = () => void
interface TapState { handler: TapHandler, detach: () => void }
const states = new WeakMap<object, TapState>()

/**
 * `v-tap="handler"` — a tap handler that counts every tap, for anything
 * people tap repeatedly that isn't an <NButton>: steppers, list rows,
 * cards. Adds a ripple on Android; `v-tap.noripple` leaves it out.
 * Use it instead of @tap on the same element, not as well as.
 *
 * Registered globally by the generated app entry.
 */
export const vTap: Directive<{ nativeView: View }, TapHandler> = {
  mounted(el, binding) {
    const view = el.nativeView
    const state: TapState = { handler: binding.value, detach: () => {} }
    const fire = () => state.handler?.()
    if (isAndroid) {
      state.detach = attachNativeClick(view, fire, binding.modifiers.noripple ? { rippleColor: false } : {})
    } else {
      view.on('tap', fire)
      state.detach = () => view.off('tap', fire)
    }
    states.set(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (state) state.handler = binding.value
  },
  beforeUnmount(el) {
    states.get(el)?.detach()
    states.delete(el)
  }
}
