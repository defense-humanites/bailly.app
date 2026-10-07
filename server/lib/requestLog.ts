/**
 * A line of the Worker's logs per request kept, to tell the robots' traffic
 * apart (which ones, on which pages, from which networks): without the
 * visitor's address nor place (cf. `confidentialité.vue`, « Adresses IP »).
 * The invocation logs of Cloudflare stay off (`wrangler.jsonc`): they keep
 * all that. Cloudflare adds to each line the request's address, its query
 * redacted (`redact_query_string`, the searches of `/forme`).
 *
 * Kept: every error, every agent that is not a browser (declared robots,
 * scripts), and a sample of the apparent browsers (visitors, and robots
 * disguised as browsers, which the other fields betray). Never the
 * synchronization API.
 */

/**
 * What Cloudflare tells of the request (`request.cf`), the fields kept.
 */
export type RequestCf = {
  asn?: number;
  asOrganization?: string;
  country?: string;
  /**
   * For a robot verified by Cloudflare, its category (e.g. "Search Engine
   * Crawler", "AI Crawler"); empty otherwise.
   */
  verifiedBotCategory?: string;
};

export type PageKind = "home" | "entry" | "form" | "reader" | "page" | "legacy" | "api" | "other";

/**
 * The share of the apparent browsers' requests kept.
 */
export const BROWSER_SAMPLE_RATE = 0.1;

/**
 * The fixed pages (decoded), cf. `app/pages`, and the server's files.
 */
const PAGES = new Set(["à-propos", "nouveautés", "préférences", "signets", "confidentialité", "paramètres", "soutenir", "sitemap.xml"]);

/**
 * The kind of page a path leads to (without its query).
 */
export function pageKind(path: string): PageKind {
  if (path === "/") return "home";
  if (path.startsWith("/api/")) return "api";
  if (path.startsWith("/q=")) return "legacy";

  let segments: string[];
  try {
    segments = decodeURI(path).split("/").filter(Boolean);
  } catch {
    return "other";
  }
  const [first] = segments;
  if (first === undefined) return "other";
  if (first === "forme") return "form";
  if (first === "lecteur" && segments.length === 1) return "reader";
  if (PAGES.has(first)) return "page";
  // An entry's URI: a single segment, neither a file (`wp-login.php`) nor
  // Nuxt's (`_nuxt`, `__nuxt_error`).
  if (segments.length === 1 && !first.includes(".") && !first.startsWith("_")) return "entry";
  return "other";
}

/**
 * Agents that are not browsers, though they may begin as one (`Mozilla/5.0
 * (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`).
 */
const NOT_A_BROWSER = /bot|crawl|spider|slurp|scrap|fetch|preview|headless|https?:|python|curl|wget|java\/|go-http|node|axios/i;

/**
 * Whether the request seems to come from a browser: no verified robot, and an
 * agent as browsers send (`Mozilla/5.0 (…)`) without the marks of a robot.
 */
export function isBrowserLike(userAgent: string, cf: RequestCf): boolean {
  return !cf.verifiedBotCategory && /^Mozilla\/5\.0 \(/.test(userAgent) && !NOT_A_BROWSER.test(userAgent);
}

export type RequestFacts = {
  method: string;
  /**
   * The path, without the query (searches stay out of the logs).
   */
  path: string;
  status: number;
  headers: Headers;
  cf: RequestCf;
};

/**
 * The line to log for a request, or none (not kept).
 * @param draw A number in [0, 1), the sample's draw (`Math.random()`).
 */
export function requestLogLine({ method, path, status, headers, cf }: RequestFacts, draw: number): Record<string, unknown> | undefined {
  const kind = pageKind(path);
  if (kind === "api") return undefined;

  const error = status >= 500;
  const ua = headers.get("user-agent") ?? "";
  const browserLike = isBrowserLike(ua, cf);
  if (!error && browserLike && draw >= BROWSER_SAMPLE_RATE) return undefined;

  return {
    event: "request",
    method,
    kind,
    status,
    ...(error ? { path } : {}),
    ua,
    browserLike,
    bot: cf.verifiedBotCategory ?? "",
    asn: cf.asn,
    asOrg: cf.asOrganization ?? "",
    country: cf.country ?? "",
    cookie: headers.has("cookie"),
    fetchMode: headers.get("sec-fetch-mode") ?? "",
    lang: headers.has("accept-language"),
    // The share of the apparent browsers kept, to count them back.
    sample: browserLike && !error ? BROWSER_SAMPLE_RATE : 1,
  };
}
