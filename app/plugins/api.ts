import { apiBinding, createApiFetch } from "#shared/utils/apiBinding";

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
 * Provides `$api`, a `$fetch` instance bound to the Bailly API. On the
 * server, on Cloudflare, its requests go through the API Worker's service
 * binding (cf. `apiBinding`); in the browser, over the network.
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

  // In development, from another device: an API on `localhost` at the page's
  // host name (cf. `apiHostFor`).
  const host = import.meta.dev && import.meta.client ? apiHostFor(apiHost, location.hostname) : apiHost;
  const api = createApiFetch(host, import.meta.server ? apiBinding(useRequestEvent()) : undefined);

  return {
    provide: {
      api,
    },
  };
});
