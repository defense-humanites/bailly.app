import { lowerModulePreloads } from "../lib/modulePreloads";

/**
 * The scripts the page preloads (`modulepreload`), at a low priority: the
 * style sheet and the fonts first, then the scripts, which the hydration
 * needs, but not the first paint (the page being rendered by the server).
 * Measured on the home page (Lighthouse, mobile, slow 4G applied, HTTP/2,
 * 5 November 2026): first paint and LCP 4.5 s → 2.8 s; the hydration
 * ~0.4 s later. Leaving the scripts out of the preloads (fetched as the
 * entry imports them) did as well for the first paint, but delayed the
 * hydration by a second. Making the deferred components (search bar,
 * toolbar, tooltips) lazy, 49 KB fewer at first, gained nothing more.
 * Ignored by the browsers without `fetchpriority`.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html) => {
    html.head = html.head.map(lowerModulePreloads);
  });
});
