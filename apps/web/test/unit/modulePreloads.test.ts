import { describe, expect, it } from "vitest";
import { lowerModulePreloads } from "../../server/lib/modulePreloads";

describe("lowerModulePreloads", () => {
  it("lowers the priority of the module preloads", () => {
    expect(lowerModulePreloads("<link rel=\"modulepreload\" as=\"script\" crossorigin href=\"/_nuxt/a.js\"><link rel=\"modulepreload\" as=\"script\" crossorigin href=\"/_nuxt/b.js\">"))
      .toBe("<link rel=\"modulepreload\" fetchpriority=\"low\" as=\"script\" crossorigin href=\"/_nuxt/a.js\"><link rel=\"modulepreload\" fetchpriority=\"low\" as=\"script\" crossorigin href=\"/_nuxt/b.js\">");
  });

  it("leaves the other links, and a priority already set", () => {
    const html = "<link rel=\"stylesheet\" href=\"/a.css\"><link rel=\"preload\" as=\"font\" href=\"/a.woff2\"><link rel=\"modulepreload\" fetchpriority=\"high\" href=\"/_nuxt/a.js\">";
    expect(lowerModulePreloads(html)).toBe(html);
  });
});
