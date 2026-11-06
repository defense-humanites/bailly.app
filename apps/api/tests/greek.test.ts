import { assertEquals } from "./support/assert.ts";
import { app, morpheusAvailable } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";
import {
  fromMorpheusBetaCode,
  lemmaToGreek,
  normalizeUri,
  queryToGreek,
  toMorpheusBetaCode
} from "../src/greek.ts";

/*
 * The conversions of `src/greek.ts`, as the API relies on them. Moving from
 * greek-conversion 1.0.0-beta.8 to 1.0.0-rc.6 (compared over the inputs of every
 * usage, cf. `claude/api-greek-conversion-rc6.md` in the project notes) changed
 * nothing but the cases below, all for the better:
 *
 *   - `ks` is read as κσ, no longer contracted to ξ: a headword in ἐκσ- (62 URIs
 *     in `eks…`) typed in Beta Code or in transliteration is found;
 *   - an apostrophe after a vowel in Beta Code is the elision mark, no longer a
 *     breve (`di'` → δι’);
 *   - a breathing on the first vowel of a pair that could be a diphthong stays
 *     there (Ἅιδης): Morpheus then analyzes the form when diacritics are kept;
 *   - the lemmas of Morpheus resolve to 64 more entries (77 237 of 91 884, none
 *     lost): those in ἐκσ-, and those with a quantity mark (`a)/xru_sos`), now
 *     removed. The library no longer moves onto the second vowel a breathing that
 *     Morpheus writes on the first one of a diphthong (`e)u/klwstos`): the API does
 *     it for the lemmas, so that they still find the Bailly's spelling (εὔκλωστος).
 *
 * And the URIs keep their `u` for upsilon (`psuchê`), which is no longer the
 * library's default.
 */

test("normalizeUri: diacritics removed, rough breathing and long vowels kept", () => {
  assertEquals(normalizeUri("hódos"), "hodos");
  assertEquals(normalizeUri("hēmera"), "hêmera");
  assertEquals(normalizeUri("psūchḗ"), "psuchê");
  assertEquals(normalizeUri("psuchê"), "psuchê");
});

// The library writes the acute as an oxia (U+1F71…): compared in NFC (tonos), as
// the search keys and the dictionary's text are.
const nfc = (value: string) => value.normalize("NFC");

test("queryToGreek: Beta Code", () => {
  assertEquals(nfc(queryToGreek("lo/gos", "beta-code")), "λόγος");
  assertEquals(nfc(queryToGreek("e)ksaghneu/w", "beta-code")), "ἐκσαγηνεύω");
  assertEquals(nfc(queryToGreek("e)/kstasis", "beta-code")), "ἔκστασις");
  assertEquals(nfc(queryToGreek("di'", "beta-code")), "δι’");
});

test("queryToGreek: transliteration", () => {
  assertEquals(nfc(queryToGreek("psuchḗ", "transliteration")), "ψυχή");
  assertEquals(
    nfc(queryToGreek("eksagēneúō", "transliteration")),
    "ἐκσαγηνεύω"
  );
  assertEquals(nfc(queryToGreek("Háidēs", "transliteration")), "Ἅιδης");
});

test("toMorpheusBetaCode: Perseus Beta Code", () => {
  assertEquals(toMorpheusBetaCode("λόγου"), "lo/gou");
  assertEquals(toMorpheusBetaCode("Ἀθῆναι"), "*)aqh=nai");
  assertEquals(toMorpheusBetaCode("ᾧ"), "w(=|");
  assertEquals(toMorpheusBetaCode("Ἅιδης"), "*(/aidhs");
});

test("fromMorpheusBetaCode, lemmaToGreek: Morpheus' words in Greek", () => {
  // Morpheus' quantity marks (`_`, `^`) are not Beta Code: removed.
  assertEquals(fromMorpheusBetaCode("a)/lla_"), "ἄλλα");
  assertEquals(fromMorpheusBetaCode("a)gaqe/"), "ἀγαθέ");
  assertEquals(nfc(lemmaToGreek("lo/gos")), "λόγος");
  assertEquals(nfc(lemmaToGreek("*zeu/s")), "Ζεύς");
  assertEquals(nfc(lemmaToGreek("e)/kstasis")), "ἔκστασις");
  assertEquals(nfc(lemmaToGreek("a)/xru_sos")), "ἄχρυσος");
  // The Bailly's diphthong, not Morpheus' hiatus; a diaeresis keeps the hiatus.
  assertEquals(nfc(lemmaToGreek("e)u/klwstos")), "εὔκλωστος");
  assertEquals(nfc(lemmaToGreek("o)isto/s")), "οἰστός");
  assertEquals(nfc(lemmaToGreek("a)i/+ssw")), "ἀΐσσω");
});

test("GET /lookup?inputMode=betacode: a headword in ἐκσ- is found", async () => {
  const query = encodeURIComponent("e)ksaghneu/w");
  const response = await app.request(
    `/lookup/${query}?fields=uri&inputMode=betacode&skipMorpheus=true`
  );
  const { data } = await json(response);
  assertEquals(data.entries[0]?.uri, "eksagêneuô");
});

test({
  name: "GET /lookup/Ἅιδης?diacriticSensitive=true: Morpheus analyzes the form",
  ignore: !morpheusAvailable,
  fn: async () => {
    const response = await app.request(
      `/lookup/${encodeURIComponent("Ἅιδης")}?fields=uri&diacriticSensitive=true` +
        "&caseSensitive=true&morphology=true"
    );
    const { data } = await json(response);
    const entry = data.entries.find(
      (entry: { uri: string }) => entry.uri === "Haidês"
    );
    assertEquals(Boolean(entry?.morphology), true);
  }
});
