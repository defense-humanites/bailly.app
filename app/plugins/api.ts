/**
 * Whether a string is an absolute http(s) URL. Not with `URL.canParse`, of
 * Safari 17 only: on iOS 16, the plugin failed, and the application with it
 * (issue #10).
 */
const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/**
 * Provides `$api`, a `$fetch` instance bound to the Bailly API.
 * @see https://nuxt.com/docs/4.x/guide/recipes/custom-usefetch
 */
export default defineNuxtPlugin(() => {
  const { apiHost } = useRuntimeConfig().public;

  // Without a scheme (e.g. `localhost:3000`), `localhost:` would be read as
  // the scheme and requests would fail with an obscure cross-origin error.
  if (!isHttpUrl(apiHost)) {
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
