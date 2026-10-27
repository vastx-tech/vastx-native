export default defineNuxtConfig({
  modules: ['../src/module'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  native: {
    appId: 'org.vastxnative.playground',
    appName: 'VastX Native Playground'
  }
})
