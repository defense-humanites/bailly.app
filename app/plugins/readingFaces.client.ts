/**
 * Once the page is interactive, while the browser is idle, fetches the
 * reading font's regular and bold faces: only the face of the entries' text
 * is preloaded (cf. `useAppShell`), and a face `fonts.css` declares with
 * `font-display: block` is only fetched when some text uses it, its text
 * staying invisible meanwhile (up to 3 s). The headwords of the search
 * results (bold) did so on slow networks, the results coming before their
 * face.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:suspense:resolve", () => {
    const fetchFaces = (): void => {
      const family = readingFamily();
      if (!family) return;
      for (const weight of ["normal", "bold"]) {
        document.fonts.load(`${weight} 1em ${family}`, "α").catch(() => {});
      }
    };
    if ("requestIdleCallback" in window) requestIdleCallback(fetchFaces, { timeout: 2000 });
    else setTimeout(fetchFaces, 200);
  });
});
