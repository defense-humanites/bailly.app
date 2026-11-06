import { assertEquals } from "./support/assert.ts";
import { describe } from "vitest";
import { app } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";

/*
 * Final sigma folding in `/lookup` (cf. `formatSearchableValue()` in
 * `src/model/lookup.ts`): the searchable* columns only contain medial sigmas, so
 * the query must be folded *after* `toLowerCase()` (Σ → ς) and
 * `removeDiacritics()`, which both restore final sigmas.
 */

type LookupEntry = { uri: string; isExact: boolean };

const lookup = async (q: string, params = ""): Promise<LookupEntry[]> => {
  const response = await app.request(
    `/lookup/${encodeURIComponent(q)}?fields=uri&skipMorpheus=true${params}`
  );
  assertEquals(response.status, 200);
  return (await json(response)).data.entries;
};

const exactURIs = (entries: LookupEntry[]): string[] =>
  entries.filter((entry) => entry.isExact).map((entry) => entry.uri);

describe("GET /lookup: final sigma", () => {
  const cases: [string, string, string][] = [
    // [query, extra params, expected exact URI]
    ["λόγος", "", "logos"],
    ["^λόγος$", "", "logos"],
    ["ΛΟΓΟΣ", "", "logos"],
    ["λόγος", "&diacriticSensitive=true", "logos"],
    ["ὁδός", "&diacriticSensitive=true", "hodos"],
    ["πᾶς", "", "pas"]
  ];

  for (const [q, params, uri] of cases) {
    test(`GET /lookup/${q}${params}`, async () => {
      assertEquals(exactURIs(await lookup(q, params)), [uri]);
    });
  }
});
