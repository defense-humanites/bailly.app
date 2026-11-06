import { assert, assertEquals } from "./support/assert.ts";
import { app } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";

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
  return (await json(response)).data;
};

const uris = (data: LookupData): string[] => data.entries.map((entry) => entry.uri);

test("GET /lookup/λογο?: `?` matches exactly one character", async () => {
  assertEquals(uris(await lookup("λογο?")), ["logos", "logoô-ô"]);
});

test("GET /lookup/ω?: no `*` appended after a trailing wildcard", async () => {
  const exact = await lookup("ω?");
  const prefix = await lookup("ω?*");
  assert(exact.countAll > 0, "ω? should match the two-letter words in ω");
  assert(prefix.countAll > exact.countAll);
});

test("GET /lookup/?ων: leading `?`", async () => {
  const data = await lookup("?ων", "&limit=100");
  assert(uris(data).includes("bôn"), "?ων should match βῶν");
});

test("GET /lookup/α: `countAll` does not depend on the limit", async () => {
  const limited = await lookup("α", "&limit=10");
  const larger = await lookup("α", "&limit=100");
  assertEquals(limited.count, 10);
  assertEquals(larger.count, 100);
  assertEquals(limited.countAll, larger.countAll);
  assert(limited.countAll > 100);
});

test("GET /lookup/λογο?: `countAll` equals `count` under the limit", async () => {
  const data = await lookup("λογο?", "&limit=50");
  assertEquals(data.countAll, data.count);
});

test("GET /lookup/*ων: leading `*` (full scan), counted", async () => {
  const data = await lookup("*ων", "&limit=5");
  assertEquals(data.count, 5);
  assert(data.countAll > 5);
});

test("GET /lookup/ζζζζζ: invalid query, empty response", async () => {
  const data = await lookup("ζζζζζ");
  assertEquals([data.count, data.countAll, data.entries], [0, 0, []]);
});

/*
 * Long search keys: D1 refuses `LIKE` and `GLOB` patterns longer than 50 bytes (25
 * Greek letters), which a lookup must thus not send for a prefix, a suffix or a
 * substring (cf. `MatchKind` in `src/model/lookup.ts`).
 */
const LONG = "εννεακαιεικοσικαιεπτακοσιοπλασιακις"; // 35 letters, 70 bytes

test("GET /lookup: long key, every kind of match", async () => {
  const expected = ["enneakaieikosikaieptakosioplasiakis"];
  assertEquals(uris(await lookup(LONG)), expected);
  assertEquals(uris(await lookup(`"${LONG}"`)), expected);
  assertEquals(uris(await lookup(`${LONG}$`)), expected);
  assertEquals(uris(await lookup(`*${LONG.slice(5)}`)), expected);
});

test("GET /lookup: a `GLOB` pattern over 50 bytes gives an empty response", async () => {
  const data = await lookup(`${LONG.slice(0, 20)}?${LONG.slice(21)}`);
  assertEquals([data.count, data.countAll, data.entries], [0, 0, []]);
});
