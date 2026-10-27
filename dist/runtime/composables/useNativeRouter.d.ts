import { $navigateBack } from 'nativescript-vue';
import type { NativeRoute } from '#build/vastx-native/route-manifest.mjs';
type NavigateBackOptions = NonNullable<Parameters<typeof $navigateBack>[0]>;
export interface NavigateOptions {
    /** Passed through as the page's navigation context / component props. */
    params?: Record<string, unknown>;
    transition?: {
        name?: string;
        duration?: number;
        curve?: unknown;
    };
    clearHistory?: boolean;
    backstackVisible?: boolean;
    animated?: boolean;
}
/**
 * Replaces vue-router for native builds: there is no DOM `history` to push
 * state onto, so navigation instead pushes/pops NativeScript's native Frame
 * backstack via nativescript-vue's $navigateTo/$navigateBack. Route names
 * come from the manifest generated from `app/pages` (see
 * src/build/generate-routes.ts) so page authoring still feels like Nuxt
 * file-based routing, even though nothing here touches vue-router.
 */
export declare function useNativeRouter(): {
    routes: NativeRoute[];
    navigate: (name: string, options?: NavigateOptions) => Promise<import("@nativescript/core").Page>;
    back: (options?: NavigateBackOptions) => Promise<void>;
    canGoBack: () => boolean;
    /** Stack of route names navigated so far, most recent last. */
    current: Readonly<import("vue").Ref<readonly string[], readonly string[]>>;
};
export {};
