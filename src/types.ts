export interface VastXNativeOptions {
  /**
   * Reverse-DNS application identifier, e.g. "com.acme.myapp".
   * Used when scaffolding the native iOS/Android projects.
   */
  appId: string
  /** Human-readable app name shown on the device home screen. */
  appName: string
  /** Native platforms this project targets. */
  platforms: Array<'ios' | 'android'>
  /**
   * Path (relative to the app's srcDir) to the root Vue component that
   * `nativescript-vue` mounts as the app's first Frame/Page.
   */
  entry: string
  /** Styling setup: native CSS, Tailwind, or automatic detection for existing projects. */
  styling?: 'native' | 'tailwind' | 'auto'
  /**
   * npm package names of third-party vastx-native plugins to run native
   * setup for. Each listed package is resolved for a `"./vastx-native"`
   * subpath export — if present, its `ensure(projectRoot, platforms)`
   * function is called on every `init`/`dev`/`build` (idempotent, same as
   * this framework's own `ensureWebSocketDependency`/
   * `ensureNetworkSecurityConfig`). A package with no such subpath is left
   * alone — not every plugin needs native dependency/permission wiring.
   */
  plugins: string[]
  /**
   * Android app theme, generated into App_Resources/Android/src/main/res
   * on every init/dev/build. Hex colours (#RRGGBB). Without it, the
   * NativeScript template's light theme applies.
   */
  theme?: {
    /** Window background and status bar. A dark one also switches to the dark system theme. */
    background: string
    /** Toolbar (ActionBar) colour. Default: `background`. */
    primary?: string
    /** Accent for system widgets. Default: `primary`. */
    accent?: string
  }
  android?: {
    /** Minimum Android API level. Default 23 (Android 6.0). */
    minSdk?: number
    /**
     * Stop Gradle's background daemon after `build`/`analyze` and when
     * `dev` exits, freeing about 1 GB. Default: only on machines with less
     * than 12 GB of RAM. Keeping it makes the next build start faster.
     */
    stopGradleDaemon?: boolean
  }
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    native?: Partial<VastXNativeOptions>
  }
  interface NuxtOptions {
    native: VastXNativeOptions
  }
}
