import { convert } from "@humanities/greek-conversion";

/**
 * Beta Code letters and diacritics (as typed in the search bar).
 * @remarks Search metacharacters (`^`, `$`, `?`, `*`, `"`) are left out: in
 * Beta Code, `*` marks a capital and `?` an underdot.
 */
const BETA_CODE_RUN = /[a-z()/\\=|+]+/gi;
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
 * Converts the search bar input into Greek: Beta Code runs are converted
 * (e.g. `logos` → `λογος`, `vergon` → `ϝεργον`), Greek and search
 * metacharacters are kept.
 * @remarks The input may mix Greek (already converted) and Beta Code (the
 * last characters typed).
 */
export function toSearchGreek(input: string): string {
  return normalizeSearchGreek(
    input.replace(BETA_CODE_RUN, run => convert(run, "beta-code", "greek", { removeDiacritics: true })),
  );
}
