/**
 * Search keys of the Bailly: the generic search key (`toSearchKey()`), preceded by
 * the clean-up rules specific to the dictionary's headwords.
 *
 * The same function is used to index the headwords (data converter) and to
 * normalize the queries (API): that is what guarantees that they match.
 */

import { type SearchKeyOptions, toSearchKey } from "./searchKey.ts";

/** The searchable columns of the Bailly database. */
export type SearchColumn =
  | "searchable"
  | "searchableCaseInsensitive"
  | "searchableAtonic"
  | "searchableAtonicCaseInsensitive";

export interface BaillySearchKeyOptions {
  /** Keep the letter case (default: `false`). */
  caseSensitive?: boolean;
  /** Keep the diacritics (default: `false`). */
  diacriticSensitive?: boolean;
}

/** Options of `toBaillySearchKey()` for each searchable column. */
export const SEARCH_COLUMNS: Readonly<
  Record<SearchColumn, Readonly<BaillySearchKeyOptions>>
> = {
  searchable: { caseSensitive: true, diacriticSensitive: true },
  searchableCaseInsensitive: { caseSensitive: false, diacriticSensitive: true },
  searchableAtonic: { caseSensitive: true, diacriticSensitive: false },
  searchableAtonicCaseInsensitive: { caseSensitive: false, diacriticSensitive: false }
};

/**
 * τὶς (indefinite pronoun) is the only headword whose grave accent is lexical: the
 * Bailly distinguishes it from τίς (interrogative pronoun).
 */
const TIS_GRAVE = "τὶς".normalize("NFD");

function isTisGrave(text: string): boolean {
  return text.normalize("NFD").toLowerCase() === TIS_GRAVE;
}

/**
 * Removes what isn't part of the searchable form of a headword (or of a query):
 * 1. standardizes the spaces;
 * 2. removes the initial hyphens, so that suffixes and enclitic particles can be
 *    found without them (e.g. "-δε" → "δε");
 * 3. removes everything from the first comma or hyphen that isn't at the beginning
 *    (e.g. "ἀγαπάω-ῶ" → "ἀγαπάω", "χόος-χοῦς" → "χόος");
 * 4. removes the right single quotation marks (U+2019, elision);
 * 5. removes the parentheses, keeping their content (e.g. "-φι(ν)" → "φιν").
 */
export function cleanBaillyText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^-+/, "")
    .replace(/(?<!^)[,-].*$/, "")
    .replace(/’/g, "")
    .replace(/[()]/g, "");
}

/**
 * Returns the search key of a Bailly headword or of a query.
 * Graves are turned into acutes (e.g. in "Διὸς ἱερόν"), except for τὶς.
 */
export function toBaillySearchKey(
  text: string,
  { caseSensitive = false, diacriticSensitive = false }: BaillySearchKeyOptions = {}
): string {
  const cleaned = cleanBaillyText(text);

  const options: SearchKeyOptions = {
    caseSensitive,
    diacritics: diacriticSensitive,
    graves: isTisGrave(cleaned) ? "keep" : "acute"
  };

  return toSearchKey(cleaned, options);
}

/** Returns the values of the searchable columns for a Bailly headword. */
export function toBaillySearchColumns(word: string): Record<SearchColumn, string> {
  return Object.fromEntries(
    Object.entries(SEARCH_COLUMNS).map(([column, options]) => [
      column,
      toBaillySearchKey(word, options)
    ])
  ) as Record<SearchColumn, string>;
}
