/**
 * Once the page is interactive, while the browser is idle, fetches the faces
 * that the page doesn't preload but that some text may soon use; a face is
 * otherwise only fetched when some text first uses it:
 *
 * - the reading font's faces of the text (its weight, cf.
 *   `readingTextWeight`) and of the bold: only the face of the entries' text
 *   is preloaded (cf. `useAppShell`), and a face `fonts.css` declares with
 *   `font-display: block` keeps its text invisible meanwhile (up to 3 s).
 *   The headwords of the search results (bold) did so on slow networks, the
 *   results coming before their face;
 * - Inter's italic (`swap`): its text, first shown in the fallback's italic,
 *   was laid out anew on its arrival, moving what follows, e.g. in a popover
 *   just opened (the home page's « édition du texte », a title in italics).
 *   Its common characters only (the file of the rare ones, cf. `fonts.css`,
 *   is left to the text needing it).
 *
 * Not where the document has no font loading API (`document.fonts`): the
 * unit tests' DOM (happy-dom), where the fetch, after a test, threw.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:suspense:resolve", () => {
    const fetchFaces = (): void => {
      if (!("fonts" in document)) return;
      const family = readingFamily();
      if (family) {
        for (const weight of [readingTextWeight(), "bold"]) {
          document.fonts.load(`${weight} 1em ${family}`, "α").catch(() => {});
        }
      }
      document.fonts.load("italic 1em Inter", "a").catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(fetchFaces, { timeout: 2000 });
    else setTimeout(fetchFaces, 200);
  });
});
