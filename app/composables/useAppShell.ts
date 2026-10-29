import { READING_FONTS } from "~/utils/fonts";

/**
 * What every page of the application has, set by the root component: the
 * reading preferences as attributes of the root element, the theme, the
 * head (title template, description, icons) and the audience measurement.
 * Shared by `app.vue` and `error.vue` (which replaces it when a page fails:
 * without it, the error page would lose them).
 */
export function useAppShell(): void {
  /**
   * The reading preferences, as attributes of the root element (cf.
   * `--reading-font-size`), rendered by the server too.
   */
  const { preference } = usePreferences();
  const readingFont = preference("readingFont");
  const readingSize = preference("readingSize");
  const readingWeight = preference("readingWeight");

  // The theme, a preference that the color mode applies.
  if (import.meta.client) useThemePreference();

  /*
   * The audience measurement (Cloudflare Web Analytics, since 28 October
   * 2026): not in the application, its script added to the pages by
   * Cloudflare, at the edge, on `bailly.app` only (its automatic setup, a
   * setting of the zone): neither on the preview, nor in the tests or in
   * development.
   */
  useHead({
    /*
     * A page's own title, bare (more readable, in a tab as in the results;
     * the search engines show the site's name apart, cf. the home page's
     * structured data); without one (the home page), the site's.
     */
    titleTemplate: (title) => {
      return title ? title : "Bailly.app — Dictionnaire grec-français en ligne";
    },
    meta: [
      {
        name: "description",
        content:
          "Consultez le dictionnaire grec-français d'Anatole Bailly, dans une application libre et gratuite.",
      },
      { property: "og:site_name", content: "Bailly.app" },
    ],
    htmlAttrs: {
      "lang": "fr",
      "data-reading-font": readingFont,
      "data-reading-size": readingSize,
      "data-reading-weight": readingWeight,
    },
    link: [
      // The face of the entries' text (the chosen font and weight), known
      // by the server: fetched as soon as possible.
      computed(() => {
        const href = READING_FONTS[readingFont.value].text[readingWeight.value];
        return { rel: "preload", as: "font", type: "font/woff2", href, crossorigin: "anonymous" };
      }),
      { rel: "icon", type: "image/png", href: "/favicon/favicon-96x96.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon/favicon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
    ],
  });
}
