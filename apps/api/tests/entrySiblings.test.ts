import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";

/*
 * Fields of the siblings returned by `/entry/:uri?siblings=true`: `siblingsFields`
 * (same syntax as `fields`), `fields` by default. An entry page needs the whole entry,
 * but only a preview of its siblings (word, URI, excerpt): without `siblingsFields`,
 * it also received their full definitions.
 */

type Fields = Record<string, unknown>;

type EntryData = {
  $query: Record<string, unknown>;
  entry: Fields & { children?: Fields[] };
  siblings: { previous?: Fields; next?: Fields };
};

const getEntry = async (uri: string, params: string): Promise<EntryData> => {
  const response = await app.request(`/entry/${encodeURIComponent(uri)}?${params}`);
  assertEquals(response.status, 200);
  return (await response.json()).data;
};

const postEntries = async (body: Record<string, unknown>): Promise<EntryData[]> => {
  const response = await app.request("/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assertEquals(response.status, 200);
  return (await response.json()).queries.map(
    (query: { data: EntryData }) => query.data
  );
};

const keys = (fields?: Fields): string[] => Object.keys(fields ?? {}).toSorted();

const assertSiblingsFields = (data: EntryData, expected: string[]) => {
  assert(data.siblings.previous && data.siblings.next, "two siblings expected");
  assertEquals(keys(data.siblings.previous), expected.toSorted());
  assertEquals(keys(data.siblings.next), expected.toSorted());
};

const PAGE_FIELDS = "word,uri,excerpt,htmlDefinition";

Deno.test("GET /entry/logos?siblings=true: siblings with `fields` by default", async () => {
  const data = await getEntry("logos", `fields=${PAGE_FIELDS}&siblings=true`);
  assertSiblingsFields(data, PAGE_FIELDS.split(","));
});

Deno.test("GET /entry/logos?siblingsFields=word,uri,excerpt: siblings narrowed", async () => {
  const data = await getEntry(
    "logos",
    `fields=${PAGE_FIELDS}&siblings=true&siblingsFields=word,uri,excerpt`
  );

  // The entry keeps all its fields…
  assertEquals(keys(data.entry), PAGE_FIELDS.split(",").toSorted());
  assert(String(data.entry.htmlDefinition).length > 1000);

  // … its siblings only the requested ones, with the same values as by default.
  assertSiblingsFields(data, ["word", "uri", "excerpt"]);

  const full = await getEntry("logos", `fields=${PAGE_FIELDS}&siblings=true`);
  for (const side of ["previous", "next"] as const) {
    const { htmlDefinition: _, ...expected } = full.siblings[side]!;
    assertEquals(data.siblings[side], expected);
  }
});

Deno.test("GET /entry: `siblingsFields` without `word`, and wider than `fields`", async () => {
  // `word` is not added to the siblings (it is to the entry, which needs it).
  assertSiblingsFields(
    await getEntry("logos", "fields=word,uri&siblings=true&siblingsFields=uri"),
    ["uri"]
  );
  assertSiblingsFields(
    await getEntry("logos", "fields=uri&siblings=true&siblingsFields=word,uri,excerpt"),
    ["word", "uri", "excerpt"]
  );
});

Deno.test("GET /entry: invalid `siblingsFields` fall back to `fields`", async () => {
  for (const value of ["", "foo", "word,foo"]) {
    const data = await getEntry(
      "logos",
      `fields=word,uri&siblings=true&siblingsFields=${value}`
    );
    assertSiblingsFields(data, ["word", "uri"]);
  }
});

Deno.test("GET /entry: `siblingsFields` without `siblings=true` returns no siblings", async () => {
  const data = await getEntry("logos", "fields=word,uri&siblingsFields=uri");
  assertEquals(data.siblings, {});
  assertEquals(keys(data.entry), ["uri", "word"]);
});

Deno.test("GET /entry/ha_(2): homonyms, siblings around the group", async () => {
  // ἅ (2) has two homonyms (ha_(2)#1, ha_(2)#2): the siblings surround the group.
  const data = await getEntry(
    "ha_(2)",
    `fields=${PAGE_FIELDS}&siblings=true&siblingsFields=word,uri`
  );
  assertEquals(data.entry.children?.length, 2);
  assertSiblingsFields(data, ["word", "uri"]);
  assert(
    data.siblings.previous!.uri !== "ha_(2)" && data.siblings.next!.uri !== "ha_(2)"
  );
});

Deno.test("POST /entry: `siblingsFields` in a batch", async () => {
  const [logos, hodos] = await postEntries({
    q: "logos,hodos",
    fields: PAGE_FIELDS,
    siblings: true,
    siblingsFields: ["word", "uri", "excerpt"]
  });
  assertSiblingsFields(logos, ["word", "uri", "excerpt"]);
  assertSiblingsFields(hodos, ["word", "uri", "excerpt"]);
  assertEquals(keys(logos.entry), PAGE_FIELDS.split(",").toSorted());
});
