import type { LookupEntry } from "#shared/types/api";
import { splitExcerpt } from "~/helpers";
import { homonymAnchor } from "~/utils/entryUri";

/** The fields of the entries in the search results. */
type ResultEntry = Pick<LookupEntry<"word" | "uri" | "excerpt">, "word" | "uri" | "excerpt" | "isExact" | "isMorpheus" | "children">;

/** A result of the search bar: an entry, or homonyms' common headword. */
export type SearchResultItem = {
  /** Its key among the results (its URI; a headword's, prefixed). */
  key: string;
  /** Its place among all the results (the arrow keys, the highlight). */
  index: number;
  /** The entry's URI, which the result opens. */
  uri: string;
  /** The headword, in bold (empty if the excerpt doesn't start with it). */
  word: string;
  /** The rest of the excerpt. */
  rest: string;
  /** Whether it is a homonym, indented under its headword. */
  nested: boolean;
  /** A homonym's number (e.g. `oudos#2` → `2`), after its headword. */
  homonym?: string;
  /** Whether the morphological analysis found it. */
  isMorpheus: boolean;
};

/** A group of results, under its label. */
export type SearchResultGroup = {
  key: string;
  label: string;
  items: SearchResultItem[];
};

/**
 * The search results in two groups: the exact matches (the API sorts those
 * found through their inflected form last), then the other entries; each
 * entry a result, or its homonyms under their common headword (which leads
 * to the whole entry page). Each result numbered in the order of all.
 */
export function searchResultGroups(entries: readonly ResultEntry[]): SearchResultGroup[] {
  let index = 0;
  const item = (entry: Pick<ResultEntry, "word" | "uri" | "excerpt"> & { isMorpheus?: boolean }, nested: boolean, headword = false): SearchResultItem => {
    const { word, rest } = headword ? { word: entry.word, rest: "" } : splitExcerpt(entry.word, entry.excerpt);
    return {
      key: headword ? `headword:${entry.uri}` : entry.uri,
      index: index++,
      uri: entry.uri,
      word,
      rest,
      nested,
      homonym: nested ? homonymAnchor(entry.uri) : undefined,
      isMorpheus: entry.isMorpheus ?? false,
    };
  };
  const items = (entry: ResultEntry): SearchResultItem[] =>
    entry.children?.length
      ? [item(entry, false, true), ...entry.children.map(child => item(child, true))]
      : [item(entry, false)];

  const exact = entries.filter(entry => entry.isExact);
  const others = entries.filter(entry => !entry.isExact);
  return [
    { key: "exact", label: "Correspondances exactes", items: exact.flatMap(items) },
    { key: "others", label: exact.length ? "Autres entrées" : "Entrées", items: others.flatMap(items) },
  ].filter(group => group.items.length);
}
