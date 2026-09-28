import { assert, assertEquals, equal } from "@std/assert";
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

/*
 * Crasis readings of a guessed rough breathing. Without diacritics, both breathings
 * are tried (cf. above); Morpheus may read the rough one as a crasis, e.g. ἁνα as
 * ἃ + ἔνα (late Ionic accusative of εἷς), or ἁγειρω as ἃ + ἐγείρω. These readings
 * are dropped, unless the rough breathing was typed; the other crases are kept.
 */
const allURIs = (entries: LookupEntry[]): string[] => entries.map((entry) => entry.uri);

const crasisCases: [string, string[], string[]][] = [
  // [query, Morpheus URIs expected, URIs that must be absent]
  ["ανα", ["anê"], ["heis"]],
  ["αγειρω", [], ["egeirô"]],
  ["αφιημι", [], ["ephiêmi"]],
  // Crases with a smooth breathing (ὦ ἀγαθέ) or found otherwise (οὑμός).
  ["ωγαθε", ["agathos"], []],
  ["ουμος", ["emos"], []],
  // A typed rough breathing keeps its crasis readings.
  ["ἁνα", ["heis"], []]
];

for (const [q, expected, absent] of crasisCases) {
  test(`GET /lookup/${q}: crasis readings`, async () => {
    const entries = await lookup(q);
    assertIncludes(morpheusURIs(entries), expected, q);
    for (const uri of absent) {
      assert(!allURIs(entries).includes(uri), `${q}: ${uri} should not be found`);
    }
  });
}

/*
 * Forms with many analyses. Before its 0.4.2 release, libmorpheus failed on a form
 * with more than 25 analyses (internal error), e.g. Ἰω (`*)iw`, 29), ἁπιλλω
 * (`a(pillw`, 28), ἀναλοω (`a)nalow`, 26); its 0.4.1 release crashed the process on
 * forms at 4, 5 or 8 analyses, e.g. ἀμφεσταν (`a)mfestan`). The forms are also
 * analyzed one at a time, so that a failure only loses the analyses of this form.
 */
const failureCases: [string, string[]][] = [
  ["ιω", ["eimi_(1)", "hiêmi", "Ios"]],
  ["απιλλω", ["apeileô-ô"]],
  ["αναλοω", ["analiskô"]],
  ["αμφεσταν", ["amphistêmi"]],
  ["συνετε", ["suniêmi"]]
];

for (const [q, expected] of failureCases) {
  test(`GET /lookup/${q}: forms with many analyses`, async () => {
    assertIncludes(morpheusURIs(await lookup(q)), expected, q);
  });
}

/*
 * Crasis readings are exposed in the morphology (`morphology=true`): `crasis` gives
 * the two words, in Greek (e.g. ὦγαθε: ὦ + ἀγαθέ), so that the front end can tell
 * them apart. The other readings have no `crasis`.
 */
type Crasis = { first: string; second: string };
type MorphologyEntry = LookupEntry & {
  morphology?: Record<string, { partOfSpeech: string; crasis?: Crasis }[]>;
};

const readings = async (q: string, uri: string) => {
  const response = await app.request(
    `/lookup/${encodeURIComponent(q)}?fields=uri&morphology=true`
  );
  const entries: MorphologyEntry[] = (await response.json()).data.entries;
  const entry = entries.find((entry) => entry.uri === uri);
  assert(entry?.morphology, `${q}: ${uri} should have a morphology`);
  return Object.values(entry.morphology).flat();
};

const crasisExposedCases: [string, string, Crasis][] = [
  // [query, entry URI, expected crasis]
  ["ωγαθε", "agathos", { first: "ὦ", second: "ἀγαθέ" }],
  ["ουμος", "emos", { first: "ὅ", second: "ἐμός" }],
  // A consonant: the coronis must be typed.
  ["κἀγω", "egô", { first: "καί", second: "ἐγώ" }],
  // Quantity marks of Morpheus (ἄλλᾱ) are removed.
  ["τἀλλα", "allos", { first: "τά", second: "ἄλλα" }],
  // A typed rough breathing keeps its crasis readings.
  ["ἁνα", "heis", { first: "ἅ", second: "ἔνα" }]
];

for (const [q, uri, crasis] of crasisExposedCases) {
  test(`GET /lookup/${q}?morphology=true: crasis of ${uri} exposed`, async () => {
    const crases = (await readings(q, uri)).map((reading) => reading.crasis);
    assert(
      crases.some((value) => value && equal(value, crasis)),
      `${q}: ${JSON.stringify(crasis)} missing from ${JSON.stringify(crases)}`
    );
  });
}

test("GET /lookup/ανα?morphology=true: no crasis for a direct reading", async () => {
  for (const reading of await readings("ανα", "ana_(1)")) {
    assert(!("crasis" in reading), JSON.stringify(reading));
  }
});

test("GET /lookup/ἁνα?morphology=true: a crasis and a direct reading kept apart", async () => {
  const anaReadings = await readings("ἁνα", "ana_(1)");
  assert(anaReadings.some((reading) => !reading.crasis));
  assert(
    anaReadings.some((reading) =>
      reading.crasis && equal(reading.crasis, { first: "ὁ", second: "ἀνά" })
    )
  );
});
