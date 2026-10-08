import { READING_FONTS } from "~/utils/fonts";

/**
 * Preloads the reading font's bold face on the pages showing entries (their
 * headwords are bold) and on the home page (its title too), as the face of
 * their text (cf. `useAppShell`): a face declared with `font-display: block`
 * is otherwise fetched when some text first uses it, its text staying
 * invisible meanwhile (up to 3 s, on slow networks), then laid out anew.
 * Not when the entries' text is itself bold (already preloaded).
 */
export function usePreloadBoldFace(): void {
  const { preference } = usePreferences();
  const readingFont = preference("readingFont");
  const readingWeight = preference("readingWeight");

  useHead({
    link: computed(() => readingWeight.value === "bold"
      ? []
      : [{ rel: "preload", as: "font", type: "font/woff2", href: READING_FONTS[readingFont.value].files.bold, crossorigin: "anonymous" }]),
  });
}
