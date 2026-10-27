export default defineNuxtConfig({
  modules: ['vastx-native'],
  compatibilityDate: '2026-09-23',

  native: {
    appId: "com.example.referenceapp",
    appName: "VastX Native Reference",
    theme: { background: "#F8FAFC", primary: "#4F46E5" }
  }
})
