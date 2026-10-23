import { InputMode } from "~/enums";
import { isLemmatizable, searchPlaceholder, type SearchPosition } from "~/utils/searchInput";

/**
 * The search options of the search bar, and the search preferences.
 * @remarks The options last for the visit only (shared state, not stored): an
 * option forgotten from one day to the next would silently distort the
 * results. The preferences are stored (cf. `usePreferences`).
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
   * accepted). Until the user chooses, it follows the display of Greek: a
   * reader who doesn't read Greek, who has it transliterated, types it in
   * Latin characters (`psyche` in beta code would give ψσυξηε); a choice of
   * the user prevails (e.g. a Hellenist's beta code, Greek transliterated).
   */
  const { preference, isSet } = usePreferences();
  const storedInputMode = preference("inputMode");
  const transliterateGreek = preference("transliterateGreek");
  const inputMode = computed<InputMode>({
    get: () => {
      if (isSet("inputMode")) return storedInputMode.value;
      return transliterateGreek.value ? InputMode.Transliteration : InputMode.BetaCode;
    },
    set: (mode) => {
      storedInputMode.value = mode;
    },
  });

  /**
   * Preference: whether inflected forms are looked up too, when possible (cf.
   * `isLemmatizable`).
   */
  const inflectedForms = preference("inflectedForms");

  /**
   * Whether all the options (not the preferences) have their default value.
   */
  const isDefault = computed((): boolean => position.value === "start" && !diacriticSensitive.value);

  /**
   * The search bar's placeholder: whether inflected forms are looked up shows
   * in it (cf. `searchPlaceholder`).
   */
  const placeholder = computed((): string =>
    searchPlaceholder(inputMode.value, inflectedForms.value && isLemmatizable(position.value)),
  );

  const reset = (): void => {
    position.value = "start";
    diacriticSensitive.value = false;
  };

  return { position, diacriticSensitive, inputMode, inflectedForms, placeholder, isDefault, reset };
}
