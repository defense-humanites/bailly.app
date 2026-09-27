import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";
import { Morpheus } from "../src/Morpheus.ts";

/*
 * Order of the `/lookup` results, *before* the limit is applied: exact matches (the
 * search key equals the query, without wildcards), then the lemmas found by Morpheus,
 * then the other matches, in the dictionary order.
 *
 * Regression: the rows were sorted by `orderedID` and limited, and only then flagged
 * as exact or Morpheus. `λογος$` (hundreds of compounds in -λόγος) and `*λογος` then
 * returned 30 compounds, but not λόγος; an inflected form could lose its lemma the
 * same way.
 *
 * The Morpheus tests need libmorpheus (MORPHEUS_LIBRARY_PATH, MORPHEUS_STEMLIB_PATH):
 * they are ignored when it is not available.
 */

const morpheusAvailable = (await Morpheus.getMorpheus()).isAvailable;

type LookupEntry = {
  uri: string;
  isExact: boolean;
  isMorpheus: boolean;
  children?: { uri: string }[];
};

type LookupData = { count: number; countAll: number; entries: LookupEntry[] };

const lookup = async (q: string, params = ""): Promise<LookupData> => {
  const response = await app.request(
    `/lookup/${encodeURIComponent(q)}?fields=uri${params}`
  );
  assertEquals(response.status, 200);
  return (await response.json()).data;
};

const uris = (data: LookupData): string[] => data.entries.map((entry) => entry.uri);

/** URIs of the returned rows (homonyms are grouped under a common entry). */
const rowURIs = (data: LookupData): string[] =>
  data.entries.flatMap((entry) =>
    entry.children?.map((child) => child.uri) ?? [entry.uri]
  );

for (const q of ["λογος$", "*λογος"]) {
  for (const params of ["&skipMorpheus=true", ""]) {
    Deno.test({
      name: `GET /lookup/${q}?limit=30${params}: λόγος first`,
      ignore: params === "" && !morpheusAvailable,
      fn: async () => {
        const data = await lookup(q, `&limit=30${params}`);
        assertEquals(data.count, 30);
        assert(data.countAll > 30, "the limit should be reached");
        assertEquals(data.entries[0].uri, "logos");
        assertEquals(data.entries[0].isExact, true);
        assertEquals(data.entries.filter((entry) => entry.isExact).length, 1);
      }
    });
  }
}

Deno.test("GET /lookup/λογος$?limit=1: only λόγος", async () => {
  const data = await lookup("λογος$", "&limit=1&skipMorpheus=true");
  assertEquals(uris(data), ["logos"]);
  assert(data.countAll > 1);
});

Deno.test("GET /lookup/ης?limit=2: homonyms stay grouped", async () => {
  // ἦς (1) has two homonyms, both exact: the first row is enough to rank them first.
  const data = await lookup("ης", "&limit=2&skipMorpheus=true");
  assertEquals(uris(data), ["ês_(1)"]);
  assertEquals(rowURIs(data), ["ês_(1)#1", "ês_(1)#2"]);
  assert(data.entries[0].isExact);
});

Deno.test({
  name: "GET /lookup/λογοι?limit=3: the lemma is kept when the limit is reached",
  ignore: !morpheusAvailable,
  fn: async () => {
    // λογοι* directly matches λογοιατρεία only; Morpheus finds λόγος, λογάω, λογόω.
    const data = await lookup("λογοι", "&limit=3");
    assertEquals(data.countAll, 4);
    assertEquals(uris(data).toSorted(), ["logaô-ô", "logos", "logoô-ô"]);
    assert(data.entries.every((entry) => entry.isMorpheus && entry.isExact));
  }
});

Deno.test({
  name: "GET /lookup/πολυ?limit=2: exact match, then the lemma, then the prefixes",
  ignore: !morpheusAvailable,
  fn: async () => {
    // πολύ (exact), then πολύς (lemma, and also a direct match), before the
    // hundreds of πολυ- compounds that precede it in the dictionary.
    const data = await lookup("πολυ", "&limit=2");
    assertEquals(uris(data), ["polu", "polus"]);
    assert(data.countAll > 100);
  }
});

/*
 * Whatever the limit, the results are the beginning of the unlimited results: the
 * limit never changes the order, and exact matches always come first.
 */
const prefixCases: [string, string][] = [
  ["λογος$", "&skipMorpheus=true"],
  ["*λογος", "&skipMorpheus=true"],
  ["α", "&skipMorpheus=true"],
  ["ων", "&skipMorpheus=true"],
  ["ω?", "&skipMorpheus=true"],
  ["λογοι", ""],
  ["πολυ", ""],
  ["ων", ""],
  ["ης", ""],
  ["ων$", ""],
  ['"ων"', ""]
];

for (const [q, params] of prefixCases) {
  Deno.test({
    name: `GET /lookup/${q}${params}: limited results = beginning of the results`,
    ignore: params === "" && !morpheusAvailable,
    fn: async () => {
      const all = await lookup(q, `&limit=1000${params}`);
      const allRows = rowURIs(all);

      // Without Morpheus, `isExact` is exactly the first rank. (With Morpheus, a lemma
      // that is also a direct match, e.g. πολύς for `πολυ`, is ranked as a lemma but
      // is not flagged as exact.)
      const firstNotExact = all.entries.findIndex((entry) => !entry.isExact);
      if (params.includes("skipMorpheus") && firstNotExact !== -1) {
        assert(
          all.entries.slice(firstNotExact).every((entry) => !entry.isExact),
          `${q}: an exact match comes after a non-exact one`
        );
      }

      for (const limit of [1, 2, 3, 5, 30]) {
        const limited = await lookup(q, `&limit=${limit}${params}`);
        assertEquals(rowURIs(limited), allRows.slice(0, limit), `${q}, limit=${limit}`);
        assertEquals(limited.countAll, all.countAll, `${q}, limit=${limit}`);
      }
    }
  });
}
