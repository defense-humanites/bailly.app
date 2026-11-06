/**
 * Generic search keys for Greek strings (no dependency).
 *
 * A search key is the canonical form of a string, used both to index a text and to
 * normalize the queries run against that index: as long as both sides use the same
 * function with the same options, they match.
 */

export interface SearchKeyOptions {
  /** Keep the letter case (default: `false`, i.e. lowercase). */
  caseSensitive?: boolean;
  /**
   * Keep the accents, breathings, diaeresis and iota subscript (default: `false`).
   * Quantity marks (macron, breve) are always removed.
   */
  diacritics?: boolean;
  /**
   * When diacritics are kept, what to do with grave accents (default: `"acute"`):
   * a grave is a positional variant of the acute, which users rarely type.
   */
  graves?: "acute" | "keep";
}

const GRAVE = "̀";
const ACUTE = "́";

/** Macron, breve: never typed by users, always removed. */
const QUANTITY_MARKS = /[̄̆]/g;

/**
 * Grave, acute, diaeresis, psili (smooth breathing), dasia (rough breathing),
 * perispomeni (circumflex), ypogegrammeni (iota subscript).
 */
const DIACRITICS = /[̀́̈̓̔͂ͅ]/g;

/** Glyph variants, folded into their standard letter. */
const VARIANTS: Readonly<Record<string, string>> = {
  "ς": "σ", // final sigma
  "ϲ": "σ", // lunate sigma
  "Ϲ": "Σ",
  "ϐ": "β", // beta symbol (Bailly's medial beta)
  "ϑ": "θ",
  "ϴ": "Θ",
  "ϖ": "π",
  "ϱ": "ρ",
  "ϕ": "φ",
  "ϰ": "κ"
};

const VARIANTS_PATTERN = new RegExp(`[${Object.keys(VARIANTS).join("")}]`, "g");

/**
 * Returns the search key of a (Greek) string.
 *
 * Guarantees, whatever the options:
 * - a single sigma (`σ`): final and lunate sigmas are folded, as are the other glyph
 *   variants (ϐ, ϑ, ϖ, ϱ, ϕ, ϰ);
 * - no quantity marks;
 * - NFC output (tonos rather than oxia);
 * - non-Greek characters are left untouched (e.g. the `*`, `?` wildcards);
 * - idempotence: `toSearchKey(toSearchKey(s)) === toSearchKey(s)`.
 */
export function toSearchKey(
  input: string,
  { caseSensitive = false, diacritics = false, graves = "acute" }: SearchKeyOptions = {}
): string {
  let key = input.normalize("NFD").replace(QUANTITY_MARKS, "");

  if (!diacritics) key = key.replace(DIACRITICS, "");
  else if (graves === "acute") key = key.replaceAll(GRAVE, ACUTE);

  if (!caseSensitive) key = key.toLowerCase();

  // Fold the variants last: `toLowerCase()` produces final sigmas (Σ → ς).
  return key
    .replace(VARIANTS_PATTERN, (char) => VARIANTS[char])
    .normalize("NFC");
}
