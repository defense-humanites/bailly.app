// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxt/test-utils',
  ],
  runtimeConfig: {
    public: {
      apiHost: "",
      searchDebounceTime: undefined,
      searchResultsLength: undefined,
      searchHistoryLength: undefined,
      tagMaxItems: undefined,
      maxTags: undefined,
    },
  },
})