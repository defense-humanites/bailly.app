// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxt/test-utils/module',
  ],
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        quotes: "double",
        semi: true,
        commaDangle: "always-multiline",
        braceStyle: "1tbs",
      },
      // Enables type-aware rules (e.g. `no-floating-promises`).
      typescript: {
        tsconfigPath: "./tsconfig.json",
      },
    },
  },
  ui: {
    // Fonts are self-hosted (cf. `app/assets/css/fonts.css`).
    fonts: false,
  },
  /**
   * Default values, which can be overridden with `NUXT_PUBLIC_*` environment
   * variables (cf. `.env.example`).
   */
  runtimeConfig: {
    public: {
      apiHost: "https://api.bailly.app",
      searchDebounceTime: 90,
      searchResultsLength: 30,
      searchHistoryLength: 60,
      tagMaxItems: 100,
      maxTags: 50,
    },
  },
})
