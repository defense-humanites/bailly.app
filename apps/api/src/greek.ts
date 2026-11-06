/**
 * Every conversion the API asks of `@humanities/greek-conversion`, in one place:
 * the options of each are part of the API's behavior (which entries a query
 * finds), so they are named here once and checked together when the library
 * changes.
 */

import { convert, type Format, reencode } from "@humanities/greek-conversion";

export type { Format };

/**
 * The transliteration of the dictionary's URIs and of the API's input: `u` for
 * upsilon, as the URIs write it (`psuchê`), and before `1.0.0-rc.6` the library
 * too. Its default is now the SBL style (`y`, but `u` in a diphthong), which also
 * reads a `y` after a vowel as a hiatus.
 */
const TRANSLITERATION = { upsilon: "u" } as const;

/** A query typed in Beta Code or in transliteration, in Greek (`GET /lookup`). */
export function queryToGreek(
  query: string,
  inputMode: "beta-code" | "transliteration"
): string {
  return convert(query, inputMode, "greek", { transliteration: TRANSLITERATION });
}

/** A Greek form in the Beta Code Morpheus reads (Perseus: lowercase ASCII). */
export function toMorpheusBetaCode(form: string): string {
  return convert(form, "greek", "beta-code", { preset: "perseus" });
}

/**
 * A Beta Code word of Morpheus (a lemma, a crasis, a work word) in Greek, NFC (as
 * the dictionary data: `convert()` gives the acute as an oxia, e.g. U+1F73, which
 * NFC turns into a tonos, U+03AD), without Morpheus' quantity marks (`_` macron,
 * `^` breve: not Beta Code, which writes `%26` and `%27`, so the library would
 * keep them as text).
 */
export function fromMorpheusBetaCode(betaCode: string): string {
  return convert(betaCode.replace(/[_^]/g, ""), "beta-code", "greek").normalize("NFC");
}

/**
 * A breathing (and accent) that Morpheus writes on the first vowel of an initial
 * pair that could be a diphthong (`e)u/klwstos`, `o)isto/s`: the uncontracted,
 * epic spelling, read as a hiatus), moved onto the second vowel, where the Bailly
 * has it (εὔκλωστος, οἰστός). A diaeresis marks a real hiatus (`a)i/+ssw`,
 * ἀΐσσω): left as is. greek-conversion did this move itself until `1.0.0-rc.1`.
 */
function toDiphthong(betaCode: string): string {
  return betaCode.replace(
    /^(\*?)([aeohwu])([()])([/=\\]?)([iu])(?![/=\\]*\+)/,
    "$1$2$5$3$4"
  );
}

/**
 * A lemma of Morpheus (digits of homonyms removed) in Greek, to find its entry in
 * the dictionary (cf. `getMorpheusLemmaSearchKey()`): without quantity marks, an
 * initial diphthong as the Bailly writes it.
 */
export function lemmaToGreek(lemma: string): string {
  return convert(toDiphthong(lemma.replace(/[_^]/g, "")), "beta-code", "greek");
}

/**
 * A malformed URI in the form of the dictionary's URIs (e.g. "hódos" or "hēmera"
 * for "hodos" and "hêmera"): every diacritic removed but the rough breathing's
 * `h`, long vowels with a circumflex.
 */
export function normalizeUri(uri: string): string {
  return reencode(uri, "transliteration", {
    diacritics: { all: "remove", roughBreathing: "preserve" },
    transliteration: { ...TRANSLITERATION, longVowels: "circumflex" }
  });
}
