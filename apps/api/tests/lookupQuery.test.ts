import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";

/*
 * `/lookup` without Morpheus: wildcards and counts.
 *
 *   - `?` matches exactly one character. Regression: `validateQueryStr()` used
 *     greek-conversion's `removeDiacritics(…, "greek")`, which parses `?` as a Greek
 *     question mark (U+037E), so every query containing `?` returned nothing.
 *   - No `*` is appended after a trailing wildcard (`ω?` = two letters exactly).
 *   - `countAll` is the total number of matching rows, whatever the limit; `count`
 *     is the number of rows returned. (The total is counted by a separate query,
 *     only when the limit is reached.)
 */

type LookupData = { count: number; countAll: number; entries: { uri: string }[] };

const lookup = async (q: string, params = ""): Promise<LookupData> => {
  const response = await app.request(
    `/lookup/${encodeURIComponent(q)}?fields=uri&skipMorpheus=true${params}`
  );
  assertEquals(response.status, 200);
  return (await response.json()).data;
};

const uris = (data: LookupData): string[] => data.entries.map((entry) => entry.uri);

Deno.test("GET /lookup/λογο?: `?` matches exactly one character", async () => {
  assertEquals(uris(await lookup("λογο?")), ["logos", "logoô-ô"]);
});

Deno.test("GET /lookup/ω?: no `*` appended after a trailing wildcard", async () => {
  const exact = await lookup("ω?");
  const prefix = await lookup("ω?*");
  assert(exact.countAll > 0, "ω? should match the two-letter words in ω");
  assert(prefix.countAll > exact.countAll);
});

Deno.test("GET /lookup/?ων: leading `?`", async () => {
  const data = await lookup("?ων", "&limit=100");
  assert(uris(data).includes("bôn"), "?ων should match βῶν");
});

Deno.test("GET /lookup/α: `countAll` does not depend on the limit", async () => {
  const limited = await lookup("α", "&limit=10");
  const larger = await lookup("α", "&limit=100");
  assertEquals(limited.count, 10);
  assertEquals(larger.count, 100);
  assertEquals(limited.countAll, larger.countAll);
  assert(limited.countAll > 100);
});

Deno.test("GET /lookup/λογο?: `countAll` equals `count` under the limit", async () => {
  const data = await lookup("λογο?", "&limit=50");
  assertEquals(data.countAll, data.count);
});

Deno.test("GET /lookup/*ων: leading `*` (full scan), counted", async () => {
  const data = await lookup("*ων", "&limit=5");
  assertEquals(data.count, 5);
  assert(data.countAll > 5);
});

Deno.test("GET /lookup/ζζζζζ: invalid query, empty response", async () => {
  const data = await lookup("ζζζζζ");
  assertEquals([data.count, data.countAll, data.entries], [0, 0, []]);
});
