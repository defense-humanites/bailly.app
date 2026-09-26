import type { LookupResult } from "./useApi";
import { hasWildcards, isLemmatizable, toLookupQuery, toPositionedQuery, toSearchQuery } from "~/utils/searchInput";

/**
 * The entry fields shown in the search results.
 */
export type SearchField = "word" | "uri" | "excerpt";

/**
 * Looks entries up as the query changes (debounced, cf. `searchDebounceTime`).
 * @remarks Client-side only; a newer query cancels the pending request. The
 * state is shared (`useState`, keyed `useAsyncData`), since the search bar is
 * remounted when the layout changes: `useAsyncData` then keeps the handler of
 * its first call, which must therefore only read shared state.
 */
export function useEntrySearch() {
  const { searchDebounceTime } = useRuntimeConfig().public;
  const lookup = useApiLookup();
  const { position, diacriticSensitive, inputMode, inflectedForms } = useSearchOptions();

  /**
   * The search bar input: converted into Greek while typing Beta Code (cf.
   * `toSearchGreek`), or transliterated (cf. `toLookupQuery`).
   */
  const query = useState("entry-search-query", () => "");
  /**
   * The query actually looked up.
   */
  const debouncedQuery = useState("entry-search-debounced-query", () => "");

  watchDebounced(query, (value) => {
    debouncedQuery.value = value;
  }, { debounce: searchDebounceTime });

  /**
   * The query the result belongs to (the result may be that of a previous
   * query, until the new one is looked up).
   */
  const resultQuery = useState("entry-search-result-query", () => "");

  const { data: result, status } = useAsyncData(
    "entry-search",
    async (): Promise<LookupResult<SearchField>> => {
      const input = debouncedQuery.value;
      const greek = toLookupQuery(input, inputMode.value);
      const found = await lookup(toPositionedQuery(greek, position.value), {
        fields: ["word", "uri", "excerpt"],
        inputMode: "greek",
        diacriticSensitive: diacriticSensitive.value,
        skipMorpheus: !(inflectedForms.value && isLemmatizable(position.value, hasWildcards(greek))),
      });
      resultQuery.value = input;
      return found;
    },
    {
      server: false,
      immediate: false,
      watch: [debouncedQuery, position, diacriticSensitive, inputMode, inflectedForms],
      default: () => null,
    },
  );

  /**
   * Whether results are on their way (including during the debounce delay).
   */
  const pending = computed(
    (): boolean => toSearchQuery(query.value) !== "" && (query.value !== debouncedQuery.value || status.value === "pending"),
  );

  return { query, result, resultQuery, status, pending };
}
