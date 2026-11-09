import type { Entry, EntryField } from "#shared/types/api";

/**
 * The beginning of a definition, where only its beginning is shown (the cards
 * of a form's page, cut and faded): its whole HTML would weigh on the page
 * twice, rendered by the server under the cut and in the hydration payload
 * (ὁ: 113 kB; the page of τὰ, 460 kB of HTML).
 */

const TOKEN = /<\/?([a-z][\w-]*)\b[^>]*>|&#?\w+;|[^<&]+|[<&]/gi;

const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * The beginning of an HTML fragment: its text cut after `maxLength`
 * characters (a letter with its combining marks; an entity being one), an
 * ellipsis added, and the elements left open closed, in order.
 * @returns The HTML, and the length of the text kept.
 * @example truncateHtml("<b>λόγος</b> parole", 3) // { html: "<b>λόγ…</b>", length: 3 }
 */
export function truncateHtml(html: string, maxLength: number): { html: string; length: number } {
  const open: string[] = [];
  let result = "";
  let length = 0;

  for (const [token, tag] of html.matchAll(TOKEN)) {
    if (tag) {
      const name = tag.toLowerCase();
      if (token.startsWith("</")) {
        const index = open.lastIndexOf(name);
        if (index >= 0) open.length = index;
      } else if (!VOID_ELEMENTS.has(name) && !token.endsWith("/>")) {
        open.push(name);
      }
      result += token;
      continue;
    }

    const entity = token.length > 1 && token.startsWith("&");
    // (Code points, a letter with its combining marks: no `Intl.Segmenter`,
    // which Firefox only has from 125.)
    const characters = entity ? [token] : token.match(/\P{M}\p{M}*|\p{M}+/gu)!;

    if (length + characters.length <= maxLength) {
      result += token;
      length += characters.length;
      continue;
    }

    result += characters.slice(0, maxLength - length).join("");
    return {
      html: `${result}…${open.reverse().map(name => `</${name}>`).join("")}`,
      length: maxLength,
    };
  }

  return { html, length };
}

type DefinedEntry<F extends EntryField> = Entry<F> & { htmlDefinition?: string };

/**
 * An entry with the beginning of its definition only (cf. `truncateHtml`):
 * for a group of homonyms, `maxLength` characters in all, the homonyms past
 * them left out (the first one always kept).
 */
export function withDefinitionStart<F extends EntryField>(entry: DefinedEntry<F>, maxLength: number): DefinedEntry<F> {
  if (!entry.children?.length) {
    return entry.htmlDefinition === undefined
      ? entry
      : { ...entry, htmlDefinition: truncateHtml(entry.htmlDefinition, maxLength).html };
  }

  let left = maxLength;
  const children: DefinedEntry<F>[] = [];
  for (const child of entry.children as DefinedEntry<F>[]) {
    if (left <= 0 && children.length) break;
    if (child.htmlDefinition === undefined) {
      children.push(child);
      continue;
    }
    const { html, length } = truncateHtml(child.htmlDefinition, Math.max(left, 0));
    children.push({ ...child, htmlDefinition: html });
    left -= length;
  }

  return { ...entry, children };
}
