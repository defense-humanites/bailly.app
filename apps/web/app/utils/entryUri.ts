/**
 * Homonyms are grouped under a common entry (e.g. `oudos`); each of them has
 * its own URI, made of the common one and its number (e.g. `oudos#2`), which
 * is also its anchor in the entry page.
 */
const HOMONYM_URI = /^(.*)#(\d+)$/;

/**
 * The route of an entry, or of a homonym within its entry page.
 * @example entryRoute("oudos#2") // { path: "/oudos", hash: "#2" }
 */
export function entryRoute(uri: string): { path: string; hash: string } {
  const match = HOMONYM_URI.exec(uri);
  return match ? { path: `/${match[1]}`, hash: `#${match[2]}` } : { path: `/${uri}`, hash: "" };
}

/**
 * The anchor (element id) of a homonym in its entry page.
 * @example homonymAnchor("oudos#2") // "2"
 */
export function homonymAnchor(uri: string): string | undefined {
  return HOMONYM_URI.exec(uri)?.[2];
}

/**
 * The headword of a homonym's definition followed by its number, in
 * superscript (`<sup class="homonym">`, cf. `components.css`), before the
 * comma that may close it (e.g. « οὐδός², »): the homonyms of an entry told
 * apart, as in their anchors (`#2`). Unchanged if the definition doesn't
 * open with a headword.
 * @example numberHeadword('<span class="entreea"><span class="grec">οὐδός,</span></span> …', "2")
 * // '<span class="entreea"><span class="grec">οὐδός<sup class="homonym">2</sup>,</span></span> …'
 */
export function numberHeadword(html: string, number: string): string {
  return html.replace(
    /^(\s*<span class="entreea"><span class="grec">)([^<]*?)(,?\s*<\/span>)/,
    (_, open: string, headword: string, close: string) => `${open}${headword}<sup class="homonym">${number}</sup>${close}`,
  );
}
