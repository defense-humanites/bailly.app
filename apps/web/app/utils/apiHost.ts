/** The host names of the machine itself. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The API's address for a page opened at `pageHostname`: in development,
 * an API on `localhost` (e.g. the dev server's relay, `/_api`, cf.
 * `DEV_API_PROXY`) is reached at the page's own host name when the page is
 * opened from another device (`pnpm run dev -- --host`, a phone on the local
 * network), for which `localhost` is itself.
 * @example apiHostFor("http://localhost:4321/_api", "192.168.1.20") // "http://192.168.1.20:4321/_api"
 */
export function apiHostFor(apiHost: string, pageHostname: string): string {
  const url = new URL(apiHost);
  if (!LOOPBACK.has(url.hostname) || LOOPBACK.has(pageHostname)) return apiHost;
  const origin = url.origin;
  url.hostname = pageHostname;
  return url.origin + apiHost.slice(origin.length);
}
