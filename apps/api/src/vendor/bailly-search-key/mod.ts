/**
 * @module
 * Search keys for the Bailly (Greek–French dictionary): the canonical forms used both
 * to index the headwords and to normalize the queries.
 *
 * ```ts
 * import { toBaillySearchKey } from "@humanities/bailly-search-key";
 *
 * toBaillySearchKey("Λόγος"); // "λογοσ"
 * toBaillySearchKey("λόγος", { diacriticSensitive: true }); // "λόγοσ"
 * ```
 */

export { type SearchKeyOptions, toSearchKey } from "./searchKey.ts";
export {
  type BaillySearchKeyOptions,
  cleanBaillyText,
  SEARCH_COLUMNS,
  type SearchColumn,
  toBaillySearchColumns,
  toBaillySearchKey
} from "./bailly.ts";
