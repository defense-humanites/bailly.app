/**
 * Whether the app is built for Cloudflare: a Cloudflare preset, or a build
 * by Cloudflare (Workers Builds, Pages), where Nitro picks the preset itself.
 * @remarks `NITRO_PRESET=cloudflare_module npm run dev` also emulates the
 * Cloudflare bindings locally (D1 included), with Wrangler.
 */
const cloudflare = Boolean(
  process.env.NITRO_PRESET?.startsWith("cloudflare") || process.env.WORKERS_CI || process.env.CF_PAGES,
);

/**
 * The database of the bookmarks synchronization (encrypted lockers, cf.
 * `server/lib/lockers.ts`): D1 on Cloudflare (binding `BOOKMARKS_SYNC`),
 * SQLite elsewhere (`.data/bookmarks-sync.sqlite`, with `node:sqlite`).
 */
const bookmarksSyncDatabase = cloudflare
  ? { connector: "cloudflare-d1" as const, options: { bindingName: "BOOKMARKS_SYNC" } }
  : { connector: "sqlite" as const, options: { name: "bookmarks-sync" } };

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
  /**
   * The theme is kept in the local storage (cf. `StorageKey.Theme`): the
   * module applies it before the page is shown, with an inline script.
   */
  colorMode: {
    storageKey: "bailly:theme",
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
    /**
     * The daily budgets of an address and of the server for the
     * synchronization lockers (cf. `server/lib/syncBudget.ts`; 0: no limit,
     * e.g. `NUXT_SYNC_DAILY_BYTES=0`);
     * the header giving the client's address, set by the proxy in front of
     * the server (only then trusted; the connection's address otherwise);
     * an optional secret mixed in the pseudonyms of the addresses
     * (`NUXT_SYNC_ADDRESS_SECRET`).
     */
    sync: {
      dailyBytes: 1_000_000,
      dailyCreations: 100,
      dailyGrowth: 5_000_000,
      dailyTotal: 20_000_000,
      dailyTotalEstablished: 20_000_000,
      addressHeader: cloudflare ? "cf-connecting-ip" : "",
      addressSecret: "",
    },
    public: {
      apiHost: "https://api.bailly.app",
      searchDebounceTime: 90,
      searchResultsLength: 30,
      searchHistoryLength: 60,
      tagMaxItems: 100,
      maxTags: 50,
      // PayPal's donation button (cf. `PaypalDonateButton`).
      paypalDonateButtonId: "HFBZZVKRBE7HY",
      paypalEnv: "production",
    },
  },
  devServer: { port: 4321 },
  compatibilityDate: "2025-07-15",
  nitro: {
    /**
     * Cloudflare builds: `.output/server/wrangler.json` is generated from
     * `wrangler.jsonc` (Worker's name, D1 binding), with the entry point, the
     * static files and the Node.js compatibility, so that `npx wrangler --cwd
     * .output deploy` works however the build was started.
     */
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
    experimental: {
      database: true,
    },
    database: {
      bookmarksSync: bookmarksSyncDatabase,
    },
    devDatabase: {
      bookmarksSync: bookmarksSyncDatabase,
    },
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
