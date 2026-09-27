import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";

/*
 * Batch reading of excerpts, `GET /entries/excerpts?uris=…` (cf. `src/model/
 * excerpts.ts`): for bookmarks synchronized from another device, which only carry
 * their URI and word. Fixed fields (`uri`, `word`, `excerpt`, and `homonyms` for a
 * group), 1 to 100 distinct URIs, results in the requested order, unknown URIs in
 * `missing`.
 */

type ExcerptEntry = { uri: string; word: string; excerpt: string; homonyms?: number };
type ExcerptsData = { version: string; entries: ExcerptEntry[]; missing: string[] };

const request = (query: string) => app.request(`/entries/excerpts${query}`);

const getExcerpts = async (uris: string[]): Promise<ExcerptsData> => {
  const response = await request(`?uris=${encodeURIComponent(uris.join(","))}`);
  assertEquals(response.status, 200);
  return (await response.json()).data;
};

const uris = (data: ExcerptsData): string[] => data.entries.map((entry) => entry.uri);

const assertStatus = async (query: string, status: number) => {
  const response = await request(query);
  assertEquals(response.status, status, query);
  await response.body?.cancel();
};

Deno.test("GET /entries/excerpts: requested order, duplicates ignored", async () => {
  const data = await getExcerpts(["psuchê", "logos", "hodos", "logos", "psuchê"]);
  assertEquals(uris(data), ["psuchê", "logos", "hodos"]);
  assertEquals(data.missing, []);
  assertEquals(data.entries[1].word.normalize(), "λόγος");
  assert(data.version);
});

Deno.test("GET /entries/excerpts: unknown URIs in `missing`", async () => {
  const data = await getExcerpts(["introuvable", "logos", "ho", "logos#1"]);
  assertEquals(uris(data), ["logos"]);
  assertEquals(data.missing, ["introuvable", "ho", "logos#1"]);

  const none = await getExcerpts(["introuvable"]);
  assertEquals([none.entries, none.missing], [[], ["introuvable"]]);
});

Deno.test("GET /entries/excerpts: exactly the expected fields, plain text", async () => {
  const data = await getExcerpts(["logos", "hai_(1)", "Dardanos"]);
  assertEquals(Object.keys(data.entries[0]).toSorted(), ["excerpt", "uri", "word"]);
  assertEquals(Object.keys(data.entries[1]).toSorted(), ["excerpt", "uri", "word"]);
  assertEquals(
    Object.keys(data.entries[2]).toSorted(),
    ["excerpt", "homonyms", "uri", "word"]
  );
  for (const entry of data.entries) assert(!/<[a-z]/i.test(entry.excerpt));
});

Deno.test("GET /entries/excerpts: homonyms are not grouped", async () => {
  // ὁ (1) and αἱ (1) are homonyms with their own entry; Δάρδανος is a group of three
  // entries (Dardanos#1…#3), without an entry of its own.
  const data = await getExcerpts(["ho_(1)", "Dardanos", "Dardanos#2", "hai_(1)"]);
  assertEquals(uris(data), ["ho_(1)", "Dardanos", "Dardanos#2", "hai_(1)"]);

  const [ho, group, child] = data.entries;
  assertEquals(ho.word, "ὁ");
  assert(ho.excerpt.length > 0);
  assertEquals(ho.homonyms, undefined);

  assertEquals(group, { uri: "Dardanos", word: "Δάρδανος", excerpt: "", homonyms: 3 });

  assertEquals(child.word, "Δάρδανος");
  assert(child.excerpt.length > 0);
  assertEquals(child.homonyms, undefined);
});

Deno.test("GET /entries/excerpts: same excerpts as GET /entry", async () => {
  const sample = ["logos", "psuchê", "hai_(1)", "ho_(1)", "eimi_(1)"];
  const data = await getExcerpts(sample);

  for (const entry of data.entries) {
    const response = await app.request(
      `/entry/${encodeURIComponent(entry.uri)}?fields=word,excerpt`
    );
    const expected = (await response.json()).data.entry;
    assertEquals(entry.excerpt, expected.excerpt, entry.uri);
    assertEquals(entry.word, expected.word, entry.uri);
  }
});

Deno.test("GET /entries/excerpts: commas encoded or not", async () => {
  for (const query of ["?uris=logos,hodos", "?uris=logos%2Chodos"]) {
    const response = await request(query);
    assertEquals(response.status, 200);
    assertEquals(uris((await response.json()).data), ["logos", "hodos"]);
  }
});

Deno.test("GET /entries/excerpts: 100 distinct URIs accepted", async () => {
  const hundred = Array.from({ length: 100 }, (_, i) => `x${i}`);
  const data = await getExcerpts([...hundred, "x0", "x1"]);
  assertEquals(data.missing.length, 100);
});

Deno.test("GET /entries/excerpts: invalid lists refused (400)", async () => {
  const tooMany = Array.from({ length: 101 }, (_, i) => `x${i}`).join(",");
  for (
    const query of [
      "",
      "?uris=",
      "?uris=%20",
      `?uris=${tooMany}`,
      "?uris=logos,,hodos",
      "?uris=logos,",
      `?uris=${"a".repeat(201)}`
    ]
  ) {
    await assertStatus(query, 400);
  }
});

Deno.test("GET /entries/excerpts: cache and CORS headers", async () => {
  const response = await request("?uris=logos");
  assertEquals(
    response.headers.get("Cache-Control"),
    "public, max-age=86400, stale-while-revalidate=604800"
  );
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.body?.cancel();

  // An error is not cached.
  const error = await request("?uris=");
  assertEquals(error.status, 400);
  assert(!error.headers.get("Cache-Control")?.includes("max-age=86400"));
  await error.body?.cancel();
});
