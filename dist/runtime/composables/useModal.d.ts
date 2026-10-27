import { $showModal } from 'nativescript-vue';
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
export declare function useModal(): {
    open: <T = unknown>(component: Parameters<typeof $showModal>[0], options?: Parameters<typeof $showModal>[1]) => Promise<T | false | undefined>;
    close: (data?: unknown) => void;
};
