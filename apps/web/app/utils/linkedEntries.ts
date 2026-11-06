/**
 * The dictionary HTML links its words to their entries (cf. the data
 * converter):
 * - `<a href="/uri">`: a link to a single entry;
 * - `<span data-linked-entries="uri1,uri2">`: an ambiguous form, which may
 *   belong to several entries: it is turned into a link to its page
 *   (`formRoute`);
 * - `<span data-linked-self>`: a form of the current entry, left as is.
 */

/**
 * The route of a form's page, which offers the entries it may belong to.
 * @param uris The URIs of the entries.
 * @param form The (ambiguous) form whose link leads there.
 * @example formRoute(["hai_(1)", "ho_(1)"], "αἱ") // "/forme/%CE%B1%E1%BC%B1?q=hai_(1),ho_(1)"
 */
export function formRoute(uris: string[], form?: string): string {
  const query = uris.map(uri => encodeURIComponent(uri).replace(/%2C/gi, ",")).join(",");
  return `/forme${form ? `/${encodeURIComponent(form)}` : ""}?q=${query}`;
}

const LINKED_ENTRIES_SPAN = /<span\b([^>]*?)\sdata-linked-entries="([^"]*)"([^>]*)>/g;
const SPAN_TAG = /<(\/?)span\b[^>]*>/g;
const ANCHOR_TAG = /<(\/?)a\b([^>]*)>/g;

/**
 * The index just after the `</span>` closing the span whose content starts
 * at `from` (spans may be nested), or `-1`.
 */
function closingSpanEnd(html: string, from: number): number {
  SPAN_TAG.lastIndex = from;
  let depth = 1;
  for (let match = SPAN_TAG.exec(html); match; match = SPAN_TAG.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return SPAN_TAG.lastIndex;
  }
  return -1;
}

const escapeAttribute = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Prepares the links of a definition's HTML.
 * @param html The definition's HTML.
 * @param options.links Whether to keep links: `false` turns them into spans,
 * e.g. when the whole definition is itself a link (links can't be nested).
 * @returns The HTML, where the ambiguous forms (`span[data-linked-entries]`)
 * link to their form's page (keeping their attributes), or where no link remains.
 */
export function linkDefinition(html: string, { links = true }: { links?: boolean } = {}): string {
  if (!links) {
    return html.replace(ANCHOR_TAG, (_, closing: string, attributes: string) =>
      `<${closing}span${attributes.replace(/\s+href="[^"]*"/, "")}>`);
  }

  let result = "";
  let position = 0;
  LINKED_ENTRIES_SPAN.lastIndex = 0;

  for (let match = LINKED_ENTRIES_SPAN.exec(html); match; match = LINKED_ENTRIES_SPAN.exec(html)) {
    const [opening, before = "", uris = "", after = ""] = match;
    const contentStart = match.index + opening.length;
    const end = closingSpanEnd(html, contentStart);
    if (end < 0) break;

    const content = html.slice(contentStart, end - "</span>".length);
    const form = content.replace(/<[^>]*>/g, "").trim();
    const href = formRoute(uris.split(",").filter(Boolean), form || undefined);

    result += html.slice(position, match.index)
      + `<a href="${escapeAttribute(href)}"${before} data-linked-entries="${uris}"${after}>${content}</a>`;
    position = end;
    LINKED_ENTRIES_SPAN.lastIndex = end;
  }

  return result + html.slice(position);
}
