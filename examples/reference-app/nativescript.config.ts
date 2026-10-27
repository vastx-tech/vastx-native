import type { NativeScriptConfig } from '@nativescript/core'

export default {
  id: "com.example.referenceapp",
  appPath: '.vastx-native',
  appResourcesPath: 'App_Resources',
  main: ".vastx-native/app.js",
  bundlerConfigPath: "webpack.config.cjs",
  webpackConfigPath: "webpack.config.cjs",
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  }
} satisfies NativeScriptConfig
