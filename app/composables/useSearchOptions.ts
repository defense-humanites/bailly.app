import { isLemmatizable, type SearchPosition } from "~/utils/searchInput";

/**
 * The search options of the search bar.
 * @remarks They last for the visit only (shared state, not stored): an option
 * forgotten from one day to the next would silently distort the results.
 */
export function useSearchOptions() {
  /**
   * Where the query is looked up in the headwords.
   */
  const position = useState<SearchPosition>("search-position", () => "start");

  /**
   * Whether the diacritics (accents, breathings, iota subscripts…) must match.
   */
  const diacriticSensitive = useState<boolean>("search-diacritic-sensitive", () => false);

  /**
   * Whether inflected forms are looked up too (cf. `isLemmatizable`).
   */
  const lemmatized = computed((): boolean => isLemmatizable(position.value));

  /**
   * Whether all the options have their default value.
   */
  const isDefault = computed((): boolean => position.value === "start" && !diacriticSensitive.value);

  const reset = (): void => {
    position.value = "start";
    diacriticSensitive.value = false;
  };

  return { position, diacriticSensitive, lemmatized, isDefault, reset };
}
