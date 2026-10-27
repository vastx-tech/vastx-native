declare module '#build/vastx-native/route-manifest.mjs' {
  export interface NativeRoute {
    name: string
    path: string
    params: string[]
    component: () => Promise<{ default: unknown }>
  }

  export const routes: NativeRoute[]
}
