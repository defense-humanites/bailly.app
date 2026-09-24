// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "@nuxt/test-utils/module",
  ],
  devServer: { port: 4321 },
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
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
  compatibilityDate: "2025-07-15",
  typescript: {
    tsConfig: {
      // Report components that don't exist (e.g. renamed Nuxt UI components).
      vueCompilerOptions: {
        checkUnknownComponents: true,
      },
    },
  },
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
});
