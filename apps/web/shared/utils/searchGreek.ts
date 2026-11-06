/**
 * A Greek letter (not a modifier letter such as the spacing ypogegrammeni).
 */
export const GREEK_LETTER = String.raw`(?=\p{Script=Greek})[\p{Ll}\p{Lu}\p{Lt}]`;

// (Compiled once: a Unicode property escape is costly to compile, and the
// search bar normalizes its input several times a keystroke.)

/**
 * A final sigma within a word.
 */
const MEDIAL_FINAL_SIGMA = new RegExp(`ς(?=${GREEK_LETTER})`, "gu");

/**
 * A medial sigma ending a word.
 */
const FINAL_MEDIAL_SIGMA = new RegExp(`σ(?!${GREEK_LETTER})`, "gu");

/**
 * Normalizes Greek for the search: no letter variants, and final sigmas where
 * words end. Diacritics are kept (the API ignores them unless asked not to).
 */
export function normalizeSearchGreek(greek: string): string {
  return greek
    .normalize("NFC")
    .replace(/ϐ/g, "β")
    .replace(/ϲ/g, "σ")
    .replace(MEDIAL_FINAL_SIGMA, "σ")
    .replace(FINAL_MEDIAL_SIGMA, "ς");
}
