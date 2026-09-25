/**
 * Provides `$api`, a `$fetch` instance bound to the Bailly API.
 * @see https://nuxt.com/docs/4.x/guide/recipes/custom-usefetch
 */
export default defineNuxtPlugin(() => {
  const { apiHost } = useRuntimeConfig().public;

  // Without a scheme (e.g. `localhost:3000`), `localhost:` would be read as
  // the scheme and requests would fail with an obscure cross-origin error.
  if (!URL.canParse(apiHost) || !["http:", "https:"].includes(new URL(apiHost).protocol)) {
    throw new Error(
      `The API host must be an absolute http(s) URL, e.g. "http://localhost:3000" `
      + `(got "${apiHost}", cf. NUXT_PUBLIC_API_HOST).`,
    );
  }

  const api = $fetch.create({
    baseURL: apiHost,
  });

  return {
    provide: {
      api,
    },
  };
});
