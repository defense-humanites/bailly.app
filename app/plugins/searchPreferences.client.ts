import { InputMode, LocalStorageKey } from "~/enums";

/**
 * Loads the search preferences (input mode, lemmatization) from the local
 * storage, and saves them there when they change.
 * @remarks Same keys and values as in the previous (Astro) application. They
 * are loaded once the app is hydrated: the server renders the defaults.
 */
export default defineNuxtPlugin(() => {
  const { inputMode, lemmatization } = useSearchOptions();

  onNuxtReady(() => {
    try {
      if (localStorage.getItem(LocalStorageKey.SearchInputMode) === InputMode.Transliteration) {
        inputMode.value = InputMode.Transliteration;
      }
      lemmatization.value = localStorage.getItem(LocalStorageKey.SearchSkipLemmatization) !== "true";
    } catch {
      // Storage unavailable (e.g. blocked): the defaults remain.
    }

    watch(inputMode, (value) => {
      try {
        localStorage.setItem(LocalStorageKey.SearchInputMode, value);
      } catch {
        // Not stored: the preference lasts for the visit.
      }
    });

    watch(lemmatization, (value) => {
      try {
        localStorage.setItem(LocalStorageKey.SearchSkipLemmatization, String(!value));
      } catch {
        // Not stored: the preference lasts for the visit.
      }
    });
  });
});
