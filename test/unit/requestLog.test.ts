import { describe, expect, test } from "vitest";
import { BROWSER_SAMPLE_RATE, isBrowserLike, pageKind, requestLogLine, type RequestFacts } from "../../server/lib/requestLog";

const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const facts = (overrides: Partial<RequestFacts> & { ua?: string } = {}): RequestFacts => {
  const { ua = SAFARI, ...rest } = overrides;
  return {
    method: "GET",
    path: "/logos",
    status: 200,
    headers: new Headers({ "user-agent": ua, "accept-language": "fr-FR", "sec-fetch-mode": "navigate", "cookie": "a=b" }),
    cf: { asn: 15557, asOrganization: "Free", country: "FR", verifiedBotCategory: "" },
    ...rest,
  };
};

describe("pageKind", () => {
  test("tells the pages apart", () => {
    expect(pageKind("/")).toBe("home");
    expect(pageKind("/opsoman%C3%AAs")).toBe("entry");
    expect(pageKind(`/forme/${encodeURIComponent("ἡ")}`)).toBe("form");
    expect(pageKind("/lecteur")).toBe("reader");
    expect(pageKind("/recherche")).toBe("search");
    expect(pageKind(encodeURI("/à-propos"))).toBe("page");
    expect(pageKind("/soutenir/merci")).toBe("page");
    expect(pageKind("/sitemap.xml")).toBe("page");
    expect(pageKind("/q=λόγος")).toBe("legacy");
    expect(pageKind("/api/sync/abc")).toBe("api");
  });

  test("keeps files, Nuxt's paths and malformed paths apart from the entries", () => {
    expect(pageKind("/wp-login.php")).toBe("other");
    expect(pageKind("/__nuxt_error")).toBe("other");
    expect(pageKind("/a/b")).toBe("other");
    expect(pageKind("/%E0%A4%A")).toBe("other");
  });
});

describe("isBrowserLike", () => {
  test("a browser's agent", () => {
    expect(isBrowserLike(SAFARI, {})).toBe(true);
  });

  test("robots, declared or verified, and scripts", () => {
    expect(isBrowserLike(GOOGLEBOT, {})).toBe(false);
    expect(isBrowserLike(SAFARI, { verifiedBotCategory: "Search Engine Crawler" })).toBe(false);
    expect(isBrowserLike("python-requests/2.32", {})).toBe(false);
    expect(isBrowserLike("", {})).toBe(false);
    expect(isBrowserLike("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0 Safari/537.36", {})).toBe(false);
  });
});

describe("requestLogLine", () => {
  test("keeps a sample of the browsers, without the page's address", () => {
    expect(requestLogLine(facts(), BROWSER_SAMPLE_RATE)).toBeUndefined();
    const line = requestLogLine(facts(), 0);
    expect(line).toMatchObject({ kind: "entry", status: 200, browserLike: true, cookie: true, lang: true, fetchMode: "navigate", asn: 15557, country: "FR", sample: BROWSER_SAMPLE_RATE });
    expect(line).not.toHaveProperty("path");
  });

  test("keeps every robot", () => {
    expect(requestLogLine(facts({ ua: GOOGLEBOT }), 0.99)).toMatchObject({ browserLike: false, sample: 1 });
  });

  test("keeps every error, with its path", () => {
    expect(requestLogLine(facts({ status: 502 }), 0.99)).toMatchObject({ path: "/logos", sample: 1 });
  });

  test("never the synchronization API", () => {
    expect(requestLogLine(facts({ path: "/api/sync/abc", ua: GOOGLEBOT, status: 500 }), 0)).toBeUndefined();
  });

  test("nothing personal", () => {
    const line = requestLogLine(facts(), 0)!;
    expect(Object.keys(line).sort()).toEqual(["asOrg", "asn", "bot", "browserLike", "cookie", "country", "event", "fetchMode", "kind", "lang", "method", "sample", "status", "ua"]);
  });
});
