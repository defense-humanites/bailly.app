import { InputMode } from "~/enums";
import type { SearchPosition } from "~/utils/searchInput";

/**
 * The search options of the search bar, and the search preferences.
 * @remarks The options last for the visit only (shared state, not stored): an
 * option forgotten from one day to the next would silently distort the
 * results. The preferences are stored (cf. `plugins/searchPreferences.client.ts`).
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
   * Preference: how Greek is typed in the search bar (Greek itself is always
   * accepted).
   */
  const inputMode = useState<InputMode>("search-input-mode", () => InputMode.BetaCode);

  /**
   * Preference: whether inflected forms are looked up too, when possible (cf.
   * `isLemmatizable`).
   */
  const lemmatization = useState<boolean>("search-lemmatization", () => true);

  /**
   * Whether all the options (not the preferences) have their default value.
   */
  const isDefault = computed((): boolean => position.value === "start" && !diacriticSensitive.value);

  const reset = (): void => {
    position.value = "start";
    diacriticSensitive.value = false;
  };

  return { position, diacriticSensitive, inputMode, lemmatization, isDefault, reset };
}
