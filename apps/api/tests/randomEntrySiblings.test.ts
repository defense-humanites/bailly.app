import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";

/*
 * Siblings of a random entry (`GET /entry/random?siblings=true&siblingsFields=…`):
 * the new home page shows the drawn entry between the previous and the next ones,
 * in one request. Same semantics as `GET /entry/:uri` (cf. `entrySiblings.test.ts`):
 * the siblings are those of the drawn entry's URI, computed by the same code
 * (`getEntry()`), including for a group of homonyms; `siblingsFields` defaults to
 * `fields`; `lengthRange` only filters the drawn entry.
 */

type Fields = Record<string, unknown>;
type Siblings = { previous?: Fields; next?: Fields };
type RandomData = {
  $query: Record<string, unknown>;
  length: number;
  entry: Fields;
  siblings?: Siblings;
};

const get = async <T>(url: string): Promise<T> => {
  const response = await app.request(url);
  assertEquals(response.status, 200, url);
  return (await response.json()).data;
};

const random = (params: string) => get<RandomData>(`/entry/random?${params}`);

const entrySiblings = async (uri: string, siblingsFields: string) =>
  (await get<{ siblings: Siblings }>(
    `/entry/${encodeURIComponent(uri)}?fields=uri&siblings=true` +
      `&siblingsFields=${siblingsFields}`
  )).siblings;

const keys = (fields?: Fields): string[] => Object.keys(fields ?? {}).toSorted();

// The front end's request.
const HOME_PAGE =
  "fields=word,uri,excerpt,htmlDefinition&lengthRange=400,700&siblings=true" +
  "&siblingsFields=word,uri,excerpt";

Deno.test("GET /entry/random?siblings=true: same siblings as GET /entry/:uri", async () => {
  for (let i = 0; i < 10; i++) {
    const data = await random(HOME_PAGE);
    const uri = String(data.entry.uri);
    assert(data.siblings, `${uri}: siblings expected`);
    assertEquals(data.siblings, await entrySiblings(uri, "word,uri,excerpt"), uri);
  }
});

Deno.test("GET /entry/random: `siblingsFields` respected, the entry keeps `fields`", async () => {
  const data = await random(HOME_PAGE);
  assertEquals(keys(data.entry), ["excerpt", "htmlDefinition", "uri", "word"]);
  assert(data.length >= 400 && data.length <= 700);
  for (const side of ["previous", "next"] as const) {
    assertEquals(keys(data.siblings?.[side]), ["excerpt", "uri", "word"], side);
  }
});

Deno.test("GET /entry/random: siblings with `fields` by default", async () => {
  const data = await random("fields=word,uri&siblings=true");
  for (const side of ["previous", "next"] as const) {
    assertEquals(keys(data.siblings?.[side]), ["uri", "word"], side);
  }
});

Deno.test("GET /entry/random: siblings without `uri` in `fields`", async () => {
  // The URI is read to find the siblings, but not added to the entry.
  const data = await random("fields=word&siblings=true&siblingsFields=word,uri");
  assertEquals(keys(data.entry), ["word"]);
  assert(data.siblings?.previous?.uri || data.siblings?.next?.uri);
});

Deno.test("GET /entry/random: group of homonyms, `lengthRange` not applied to the siblings", async () => {
  // ἄνω (2) #2 is the only entry whose definition has 3,960 characters: the draw is
  // forced. Its siblings are those of its group (ἄνω (2) #1, #2), as for
  // `GET /entry/anô_(2)#2`, and their definitions are not of this length.
  const data = await random(
    "fields=word,uri&lengthRange=3960,3960&siblings=true&siblingsFields=word,uri"
  );
  assertEquals(data.entry.uri, "anô_(2)#2");
  assertEquals(data.siblings, await entrySiblings("anô_(2)#2", "word,uri"));
  assertEquals(data.siblings?.previous?.uri, "anô_(1)");
  assertEquals(data.siblings?.next?.uri, "anôga");
});

Deno.test("GET /entry/:uri at both ends of the dictionary: a single sibling", async () => {
  // A random draw cannot be forced on them (their lengths are shared by hundreds of
  // entries); `GET /entry/random` uses the same code as `GET /entry/:uri`.
  assertEquals(await entrySiblings("A", "word,uri"), {
    previous: {},
    next: { word: "ἀ-", uri: "a-" }
  });
  assertEquals(await entrySiblings("ôôn", "word,uri"), {
    previous: { word: "ᾠώδης", uri: "ôôdês" },
    next: {}
  });
});

Deno.test("GET /entry/random without `siblings`: response unchanged", async () => {
  for (const params of ["fields=word,uri", "fields=word,uri&siblings=false"]) {
    const data = await random(params);
    assertEquals(keys(data), ["$query", "entry", "length", "version"], params);
    assertEquals(Object.keys(data.entry), ["word", "uri"], params);
  }
});
