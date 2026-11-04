import { READING_FONTS } from "~/utils/fonts";

/**
 * Preloads the italic of the entries' text (the chosen font and weight) on
 * the home page, whose entry drawn at random comes rendered by the server
 * (cf. `RandomOpening`): a face declared with `font-display: block` is
 * otherwise fetched when some text first uses it, its text staying
 * invisible meanwhile (up to 3 s, on slow networks), then laid out anew.
 * The text and bold faces are preloaded elsewhere (cf. `useAppShell`,
 * `usePreloadBoldFace`).
 */
export function usePreloadItalicFace(): void {
  const { preference } = usePreferences();
  const readingFont = preference("readingFont");
  const readingWeight = preference("readingWeight");

  useHead({
    link: computed(() => [
      { rel: "preload", as: "font", type: "font/woff2", href: READING_FONTS[readingFont.value].italic[readingWeight.value], crossorigin: "anonymous" },
    ]),
  });
}
