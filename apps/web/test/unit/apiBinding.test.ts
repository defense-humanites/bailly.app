import type { H3Event } from "h3";
import { describe, expect, it, vi } from "vitest";
import { apiBinding, apiFetchOptions, serverApiHost, type ServiceBinding } from "../../shared/utils/apiBinding";

const eventWith = (context: Record<string, unknown>) => ({ context }) as unknown as H3Event;

describe("apiBinding", () => {
  it("returns the API Worker's binding on Cloudflare", () => {
    const API: ServiceBinding = { fetch: vi.fn() };
    expect(apiBinding(eventWith({ cloudflare: { env: { API } } }))).toBe(API);
  });

  it("returns nothing elsewhere", () => {
    expect(apiBinding(undefined)).toBeUndefined();
    expect(apiBinding(eventWith({}))).toBeUndefined();
    expect(apiBinding(eventWith({ cloudflare: { env: {} } }))).toBeUndefined();
  });
});

describe("apiFetchOptions", () => {
  it("sends the requests through the binding", async () => {
    const response = new Response("{}");
    const API = { fetch: vi.fn(() => Promise.resolve(response)) };
    const { fetch } = apiFetchOptions(API);
    const init = { method: "GET" };
    await expect(fetch!("https://api.bailly.app/entry/logos", init)).resolves.toBe(response);
    expect(API.fetch).toHaveBeenCalledWith("https://api.bailly.app/entry/logos", init);
  });

  it("keeps the network without a binding", () => {
    expect(apiFetchOptions(undefined)).toEqual({});
  });
});

describe("serverApiHost", () => {
  const apiHost = "https://api.bailly.app";

  it("prefers the server's own address of the API", () => {
    expect(serverApiHost({ apiServerHost: "http://api:3000", public: { apiHost } })).toBe("http://api:3000");
  });

  it("falls back on the public address", () => {
    expect(serverApiHost({ apiServerHost: "", public: { apiHost } })).toBe(apiHost);
    expect(serverApiHost({ public: { apiHost } })).toBe(apiHost);
  });
});
