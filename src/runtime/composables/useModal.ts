import { $closeModal, $showModal } from 'nativescript-vue'

/**
 * Thin wrapper over nativescript-vue's own $showModal/$closeModal — not
 * re-implemented, just given the same composable-style API as the rest of
 * vastx-native (useNativeRouter, useDevice, ...) instead of the framework's
 * plain exported-function shape.
 *
 * ShowModalOptions isn't re-exported from nativescript-vue's package root
 * (only reachable via its internal dist/plugins/modals path — same
 * situation useNativeRouter.ts hit with NavigateBackOptions), so its shape
 * is derived from $showModal's own signature instead of importing a path
 * that isn't part of its public API.
 */
export function useModal() {
  function open<T = unknown>(
    component: Parameters<typeof $showModal>[0],
    options?: Parameters<typeof $showModal>[1]
  ) {
    return $showModal(component, options) as Promise<T | false | undefined>
  }

  function close(data?: unknown) {
    $closeModal(data)
  }

  return { open, close }
}
