// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "@nuxt/test-utils/module",
  ],
  devtools: { enabled: true },
  app: {
    head: {
      /**
       * `viewport-fit=cover`: the page extends under the device chrome (e.g. a
       * landscape notch, the iPhone home indicator), and the edges clear it
       * with the safe-area utilities (`px-safe-4`…); the insets are 0
       * otherwise.
       */
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
    },
  },
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
  devServer: { port: 4321 },
  compatibilityDate: "2025-07-15",
  nitro: {
    /**
     * Development only: relays `/_api/**` to `DEV_API_PROXY` (e.g. a local
     * API on `http://localhost:3000`), so that the browser calls the API on
     * the app's own origin (some browsers, e.g. embedded ones, block pages
     * from calling another local port). Point `NUXT_PUBLIC_API_HOST` to
     * `http://localhost:4321/_api` to use it (cf. `.env.example`).
     */
    devProxy: process.env.DEV_API_PROXY
      ? { "/_api": { target: process.env.DEV_API_PROXY, changeOrigin: true } }
      : {},
  },
  typescript: {
    // Type-check the Playwright config with the other tooling configs.
    nodeTsConfig: {
      include: ["../playwright.config.ts"],
    },
    tsConfig: {
      // Type-check the tests with the app code they exercise.
      include: ["../test/**/*"],
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
  icon: {
    // Icons from the Lucide collection (also used by Nuxt UI) and our own
    // (`i-bailly-*`, cf. `app/assets/icons`).
    customCollections: [
      { prefix: "bailly", dir: "./app/assets/icons" },
    ],
    // Embed the icons found in the sources in the client bundle.
    clientBundle: { scan: true },
    // Never rely on the Iconify API: a missing icon must show up in development.
    fallbackToApi: false,
  },
});
