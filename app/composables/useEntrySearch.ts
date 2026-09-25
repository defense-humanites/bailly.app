import type { LookupResult } from "./useApi";
import { toSearchQuery } from "~/utils/searchInput";

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

  /**
   * The search bar input, converted into Greek (cf. `toSearchGreek`).
   */
  const query = useState("entry-search-query", () => "");
  /**
   * The query actually looked up.
   */
  const debouncedQuery = useState("entry-search-debounced-query", () => "");

  watchDebounced(query, (value) => {
    debouncedQuery.value = value;
  }, { debounce: searchDebounceTime });

  const { data: result, status } = useAsyncData(
    "entry-search",
    (): Promise<LookupResult<SearchField>> =>
      lookup(toSearchQuery(debouncedQuery.value), { fields: ["word", "uri", "excerpt"], inputMode: "greek" }),
    { server: false, immediate: false, watch: [debouncedQuery], default: () => null },
  );

  /**
   * Whether results are on their way (including during the debounce delay).
   */
  const pending = computed(
    (): boolean => toSearchQuery(query.value) !== "" && (query.value !== debouncedQuery.value || status.value === "pending"),
  );

  return { query, result, status, pending };
}
