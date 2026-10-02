import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { getQuery, type H3Event } from "h3";
import { joinURL } from "ufo";
import { expect, test } from "vitest";

/**
 * Mocks an API endpoint and records the query strings it receives.
 */
const mockApi = (path: string, response: unknown) => {
  const queries: Record<string, unknown>[] = [];
  registerEndpoint(joinURL(useRuntimeConfig().public.apiHost, path), (event: H3Event) => {
    queries.push(getQuery(event));
    return response;
  });
  return queries;
};

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) parole" };

test("useApiEntry returns the entry and its siblings", async () => {
  const queries = mockApi("/entry/logos", {
    data: { version: "test", entry: logos, siblings: { next: { word: "λύω", uri: "lyô", excerpt: "λύω" } } },
  });

  const { data } = await useApiEntry("logos", { fields: ["word", "uri", "excerpt"], siblings: true });

  expect(data.value?.entry).toEqual(logos);
  expect(data.value?.siblings.next?.uri).toBe("lyô");
  expect(queries).toEqual([{ fields: "word,uri,excerpt", siblings: "true" }]);
});

test("useApiEntry asks for the siblings' own fields", async () => {
  const queries = mockApi("/entry/logos", {
    data: { version: "test", entry: logos, siblings: { next: { word: "λύω", uri: "lyô", excerpt: "λύω" } } },
  });

  const { data } = await useApiEntry("logos", {
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    siblings: true,
    siblingsFields: ["word", "uri"],
  });

  expect(data.value?.siblings.next?.word).toBe("λύω");
  expect(queries).toEqual([{ fields: "word,uri,excerpt,htmlDefinition", siblings: "true", siblingsFields: "word,uri" }]);
});

test("useApiEntry returns `null` for an unknown entry", async () => {
  mockApi("/entry/unknown", { data: { version: "test", entry: {}, siblings: {} } });

  const { data } = await useApiEntry("unknown", { fields: ["word"] });

  expect(data.value).toEqual({ entry: null, siblings: {} });
});

test("useApiLookup sorts the entries and applies the default limit", async () => {
  // (An ASCII query: the mock router doesn't match encoded non-ASCII paths.)
  const queries = mockApi("/lookup/log", {
    data: {
      version: "test",
      count: 2,
      countAll: 2,
      entries: [
        { ...logos, uri: "logas", isExact: false, isMorpheus: false },
        { ...logos, isExact: true, isMorpheus: false },
      ],
    },
  });

  const lookup = useApiLookup();
  const result = await lookup(" log ", { fields: ["word", "uri", "excerpt"], inputMode: "transliteration" });

  expect(result.entries.map(entry => entry.uri)).toEqual(["logos", "logas"]);
  expect(result.orphanMorphology).toEqual({});
  expect(queries).toEqual([{
    limit: String(useRuntimeConfig().public.searchResultsLength),
    fields: "word,uri,excerpt",
    inputMode: "transliteration",
  }]);

  // An empty query doesn't reach the API.
  expect((await lookup("  ", { fields: ["word"] })).entries).toEqual([]);
  expect(queries).toHaveLength(1);
});
