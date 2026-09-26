import { convert } from "@humanities/greek-conversion";

/**
 * A run of Greek letters (with their combining diacritics, if decomposed),
 * e.g. a word: the text around it (French, punctuation, spaces) is kept as is.
 */
// The combining diacritics are listed on purpose (decomposed Greek).
// eslint-disable-next-line no-misleading-character-class
const GREEK_RUN = /[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ]*/gu;

/**
 * Transliterates Greek (ALA-LC), keeping the ano teleia and the middle dot
 * (·), which the library would turn into semicolons.
 * @example transliterateGreek("λόγος") // "logos"
 */
export function transliterateGreek(greek: string): string {
  const prepared = greek.replace(/ϐ/g, "β").replace(/·/g, "§").replace(/·/g, "¤");
  return convert(prepared, "greek", "transliteration", { preset: "ala-lc-ancient" })
    .replace(/§/g, "·")
    .replace(/¤/g, "·");
}

/**
 * Transliterates the Greek of a text, e.g. an excerpt, leaving the rest.
 * @example transliterateText("λόγος, ου (ὁ) parole") // "logos, ou (ho) parole"
 */
export function transliterateText(text: string): string {
  return text.replace(GREEK_RUN, transliterateGreek);
}

/**
 * Transliterates the Greek of an HTML fragment (e.g. a definition), in its
 * text only (not in its tags and their attributes).
 */
export function transliterateHtml(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part, index) => (index % 2 ? part : transliterateText(part)))
    .join("");
}
