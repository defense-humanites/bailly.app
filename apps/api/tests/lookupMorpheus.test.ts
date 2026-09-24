import { assert, assertEquals } from "@std/assert";
import { app } from "../src/index.ts";
import { Morpheus } from "../src/Morpheus.ts";

/*
 * Morpheus results in `/lookup` (default search: case and diacritics insensitive).
 *
 *   - Breathings are ignored: `ων` finds ὅς (through ὧν), as `ὧν` and `ἑων` do.
 *   - Case is ignored: lowercase proper nouns are found (`διος` → Ζεύς).
 *   - Accents and iota subscripts are ignored: `ᾧ` finds ὦ (εἰμί) as `ω` does.
 *   - Morpheus is skipped as soon as a wildcard (`*`, `?`) is used; in exact mode
 *     (`"…"`), leading and trailing `*` are removed beforehand.
 *   - A Morpheus result is always an exact match: `isExact` is true (the front end
 *     relies on it to highlight, sort and filter the results).
 *
 * These tests need libmorpheus (MORPHEUS_LIBRARY_PATH, MORPHEUS_STEMLIB_PATH):
 * they are ignored when it is not available.
 */

const morpheusAvailable = (await Morpheus.getMorpheus()).isAvailable;

if (!morpheusAvailable) {
  console.warn("⚠️ libmorpheus unavailable: the Morpheus lookup tests are ignored.");
}

type LookupEntry = { uri: string; isExact: boolean; isMorpheus: boolean };

const lookup = async (q: string, params = ""): Promise<LookupEntry[]> => {
  const response = await app.request(
    `/lookup/${encodeURIComponent(q)}?fields=uri${params}`
  );
  assertEquals(response.status, 200);
  return (await response.json()).data.entries;
};

const morpheusURIs = (entries: LookupEntry[]): string[] =>
  entries.filter((entry) => entry.isMorpheus).map((entry) => entry.uri);

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, ignore: !morpheusAvailable, fn });

const assertIncludes = (actual: string[], expected: string[], q: string) => {
  for (const uri of expected) {
    assert(
      actual.includes(uri),
      `${q}: ${uri} missing from the Morpheus results [${actual.join(", ")}]`
    );
  }
};

const cases: [string, string[]][] = [
  // [query, expected Morpheus URIs (subset)]
  // Breathings.
  ["ων", ["eimi_(1)", "hos", "oun"]],
  ["ῶν", ["eimi_(1)", "hos", "oun"]],
  ["ὧν", ["eimi_(1)", "hos", "oun"]],
  ["ἑων", ["eimi_(1)", "hos"]],
  ["ης", ["eimi_(1)", "heis", "hos"]],
  ["ου", ["hos"]],
  ["ρωμης", ["rhômê"]],
  // Case.
  ["διος", ["Zeus"]],
  ["Διὸς", ["Zeus"]],
  ["αθηνας", ["Athênai"]],
  ["ομηρου", ["Homêros"]],
  ["ΛΟΓΟΥ", ["logos"]],
  // Accents and iota subscripts.
  ["ω", ["eimi_(1)", "hiêmi", "hos"]],
  ["ᾧ", ["eimi_(1)", "hiêmi", "hos"]],
  ["λογῳ", ["logos"]],
  ["ἀνθρώπῳ", ["anthrôpos"]],
  // Search modes without wildcards.
  ["^ων", ["eimi_(1)", "hos", "oun"]],
  ["ων$", ["eimi_(1)", "hos", "oun"]],
  ['"ων"', ["eimi_(1)", "hos", "oun"]],
  ['"ων*"', ["eimi_(1)", "hos", "oun"]]
];

for (const [q, expected] of cases) {
  test(`GET /lookup/${q}: Morpheus results`, async () => {
    const entries = await lookup(q);
    assertIncludes(morpheusURIs(entries), expected, q);

    // Morpheus results are exact matches.
    for (const entry of entries.filter((entry) => entry.isMorpheus)) {
      assert(entry.isExact, `${q}: ${entry.uri} should be exact`);
    }
  });
}

for (const q of ["ων*", "*ων", "ω?", "λογ?υ"]) {
  test(`GET /lookup/${q}: wildcards skip Morpheus`, async () => {
    assertEquals(morpheusURIs(await lookup(q)), []);
  });
}

test("GET /lookup/ων?skipMorpheus=true: no Morpheus results", async () => {
  assertEquals(morpheusURIs(await lookup("ων", "&skipMorpheus=true")), []);
});

test("GET /lookup/ων: entries matched by prefix only are not exact", async () => {
  const entries = await lookup("ων");
  const prefixOnly = entries.find((entry) => entry.uri === "ônamên");
  assert(prefixOnly, "ônamên should be found by prefix");
  assertEquals(prefixOnly.isExact, false);
  assertEquals(prefixOnly.isMorpheus, false);
});
