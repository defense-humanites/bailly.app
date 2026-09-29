/**
 * A Greek letter (not a modifier letter such as the spacing ypogegrammeni).
 */
export const GREEK_LETTER = String.raw`(?=\p{Script=Greek})[\p{Ll}\p{Lu}\p{Lt}]`;

/**
 * Normalizes Greek for the search: no letter variants, and final sigmas where
 * words end. Diacritics are kept (the API ignores them unless asked not to).
 */
export function normalizeSearchGreek(greek: string): string {
  return greek
    .normalize("NFC")
    .replace(/ϐ/g, "β")
    .replace(/ϲ/g, "σ")
    .replace(new RegExp(`ς(?=${GREEK_LETTER})`, "gu"), "σ")
    .replace(new RegExp(`σ(?!${GREEK_LETTER})`, "gu"), "ς");
}
