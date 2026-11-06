import type { H3Event } from "h3";

/**
 * A Cloudflare service binding: the `fetch` of another Worker, called
 * without leaving Cloudflare's network (no DNS, TLS nor public hop).
 */
export type ServiceBinding = { fetch: typeof fetch };

/**
 * The service binding to the API Worker (`API`, cf. `wrangler.jsonc`), for
 * the requests the server makes to the API (the pages it renders, the
 * redirects of searches). `undefined` elsewhere: development, a Node.js
 * server, the tests, or a deployment without the binding; the API is then
 * reached over the network, at `apiHost`.
 * @remarks Not in development even with the Cloudflare emulation
 * (`NITRO_PRESET=cloudflare_module pnpm run dev`): the binding would only
 * answer if the API ran locally under `wrangler dev`.
 */
export function apiBinding(event: H3Event | undefined): ServiceBinding | undefined {
  if (import.meta.dev) return undefined;
  const { cloudflare } = (event?.context ?? {}) as {
    cloudflare?: { env?: { API?: ServiceBinding } };
  };
  return cloudflare?.env?.API;
}

/**
 * The global options of a `$fetch` instance bound to the API (cf.
 * `createApiFetch`): its requests go through the binding when there is one.
 */
export function apiFetchOptions(binding: ServiceBinding | undefined): { fetch?: typeof fetch } {
  return binding ? { fetch: (input, init) => binding.fetch(input, init) } : {};
}

/**
 * Nitro types `$fetch.create()` with its defaults only; ofetch, which it is,
 * also takes global options, `fetch` among them.
 */
type CreateFetch = (
  defaults: Parameters<typeof $fetch.create>[0],
  globalOptions: { fetch?: typeof fetch },
) => typeof $fetch;

/**
 * A `$fetch` instance bound to the API, through the binding when there is
 * one (cf. `apiBinding`). The URLs stay the same (`apiHost`): a binding
 * ignores the host and passes the path and the query on to the API Worker.
 * @example createApiFetch(apiHost, apiBinding(event))
 */
export function createApiFetch(apiHost: string, binding: ServiceBinding | undefined): typeof $fetch {
  return ($fetch.create as CreateFetch)({ baseURL: apiHost }, apiFetchOptions(binding));
}
