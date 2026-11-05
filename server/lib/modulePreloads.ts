/** A module preload whose priority is not set yet. */
const MODULE_PRELOAD = /<link rel="modulepreload"(?![^>]*\bfetchpriority=)/g;

/**
 * Lowers the priority of the page's module preloads (`fetchpriority="low"`):
 * the scripts, fetched all at once at a high priority, shared the network
 * with the style sheet and the fonts, which the first paint waits for, and
 * the page rendered by the server, its random entry or its entry included,
 * showed after them (cf. `server/plugins/modulePreloads.ts`).
 */
export function lowerModulePreloads(html: string): string {
  return html.replace(MODULE_PRELOAD, "<link rel=\"modulepreload\" fetchpriority=\"low\"");
}
