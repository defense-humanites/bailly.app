import { transliterateHtml, transliterateText } from "~/utils/greek";

/**
 * Shows Greek as is, or transliterated if the user prefers it (cf. the
 * `transliterateGreek` preference), across the application.
 */
export function useGreek() {
  const { preference } = usePreferences();
  const transliterated = preference("transliterateGreek");

  /** A text (e.g. a headword, an excerpt). */
  const text = (value: string): string => (transliterated.value ? transliterateText(value) : value);

  /** An HTML fragment (e.g. a definition). */
  const html = (value: string): string => (transliterated.value ? transliterateHtml(value) : value);

  /** The language of Greek text, for the `lang` attributes. */
  const lang = computed((): string => (transliterated.value ? "grc-Latn" : "grc"));

  return { transliterated, text, html, lang };
}
