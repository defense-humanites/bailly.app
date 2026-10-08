import { InputMode } from "../../app/enums";
import { toLookupQuery, toSearchGreek } from "../../app/utils/searchInput";
import { searchForm } from "./legacySearch";

/**
 * The search bar's form, submitted before the page is interactive (or
 * without JavaScript): `/recherche?q=<input>`, with `mode=transliteration`
 * when the input is transliterated (cf. `SearchBarStatic`). The input is
 * converted as the search bar does (Beta Code or transliteration, Greek
 * being always accepted), then looked up as a whole form, as the former
 * search links (cf. `redirectToForm`).
 */

/**
 * The Greek form of a submitted search.
 * @returns `undefined` for an empty input; `null` if it isn't a Greek word
 * (e.g. with wildcards, which only the search bar's results apply);
 * otherwise the form (cf. `searchForm`).
 * @example searchSubmissionForm("lo/gos", undefined) // "λόγος"
 * @example searchSubmissionForm("lógos", "transliteration") // "λόγος"
 */
export function searchSubmissionForm(q: unknown, mode: unknown): string | null | undefined {
  const input = typeof q === "string" ? q.trim() : "";
  if (!input) return undefined;
  const greek = mode === InputMode.Transliteration
    ? toLookupQuery(input, InputMode.Transliteration)
    : toLookupQuery(toSearchGreek(input), InputMode.BetaCode);
  return searchForm(greek);
}
