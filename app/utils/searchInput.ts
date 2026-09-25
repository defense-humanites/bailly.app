import { convert } from "@humanities/greek-conversion";

/**
 * Beta Code letters, and the capital mark (`*`).
 */
const BETA_CODE_RUN = /[a-z*]+/gi;
/**
 * Beta Code diacritics: breathings, accents, iota subscript, diaeresis and
 * underdot (`?`). The search ignores diacritics, so they are dropped, even
 * when typed after a letter already converted into Greek (`α` + `)`).
 */
const BETA_CODE_DIACRITICS = /[()/\\=|+?]/g;
const GREEK_LETTER = String.raw`\p{Script=Greek}`;

/**
 * Normalizes Greek for the search: no diacritics, no letter variants, and
 * final sigmas where words end.
 * @remarks Greek typed or pasted with diacritics is thus accepted too.
 */
export function normalizeSearchGreek(greek: string): string {
  return greek
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .replace(/ϐ/g, "β")
    .replace(/ϲ/g, "σ")
    .replace(new RegExp(`ς(?=${GREEK_LETTER})`, "gu"), "σ")
    .replace(new RegExp(`σ(?!${GREEK_LETTER})`, "gu"), "ς");
}

/**
 * Converts the search bar input into Greek: Beta Code is converted (e.g.
 * `logos` → `λογος`, `vergon` → `ϝεργον`, `*)aqh=nai` → `Αθηναι`), Greek is
 * normalized, and the search metacharacters (`^`, `$`, `"`) are kept.
 * @remarks The input may mix Greek (already converted) and Beta Code (the
 * last characters typed). A capital mark not followed by a letter yet is kept
 * (cf. `toSearchQuery`), and capitalizes a Greek letter that follows it.
 */
export function toSearchGreek(input: string): string {
  return normalizeSearchGreek(
    input
      .replace(BETA_CODE_DIACRITICS, "")
      .replace(BETA_CODE_RUN, run => convert(run, "beta-code", "greek", { removeDiacritics: true }))
      .replace(new RegExp(`\\*+(${GREEK_LETTER})`, "gu"), (_, letter: string) => letter.toUpperCase()),
  );
}

/**
 * The query to look up, from the search bar input converted into Greek:
 * without the capital marks still waiting for their letter, which the API
 * would read as wildcards.
 */
export function toSearchQuery(greek: string): string {
  return greek.replace(/\*/g, "").trim();
}
