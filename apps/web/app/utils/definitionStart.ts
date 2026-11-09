import type { Entry, EntryField } from "#shared/types/api";

/**
 * The beginning of a definition, where only its beginning is shown (the cards
 * of a form's page, cut and faded): its whole HTML would weigh on the page
 * twice, rendered by the server under the cut and in the hydration payload
 * (ὁ: 113 kB; the page of τὰ, 460 kB of HTML).
 */

const TOKEN = /<\/?([a-z][\w-]*)\b[^>]*>|&#?\w+;|[^<&]+|[<&]/gi;

/**
 * The beginning of a definition's HTML: its text cut after `maxLength`
 * characters (an entity being one, never cut), an ellipsis added, and the
 * elements left open closed. For the dictionary's HTML: well-formed, made of
 * `span`, `a` and `div` only; the cut falls below what a card shows, where a
 * letter parted from its combining mark wouldn't be seen.
 * @example truncateHtml("<b>λόγος</b> parole", 3) // "<b>λόγ…</b>"
 */
export function truncateHtml(html: string, maxLength: number): string {
  const open: string[] = [];
  let result = "";
  let length = 0;

  for (const [token, tag] of html.matchAll(TOKEN)) {
    if (tag) {
      if (token.startsWith("</")) open.pop();
      else open.push(tag);
    } else {
      const size = token.startsWith("&") ? 1 : token.length;
      if (length + size > maxLength) {
        const kept = token.startsWith("&") ? "" : token.slice(0, maxLength - length);
        return `${result}${kept}…${open.reverse().map(name => `</${name}>`).join("")}`;
      }
      length += size;
    }
    result += token;
  }

  return html;
}

type DefinedEntry<F extends EntryField> = Entry<F> & { htmlDefinition?: string };

/**
 * An entry with the beginning of its definition only (cf. `truncateHtml`),
 * or of each of its homonyms' for a group.
 */
export function withDefinitionStart<F extends EntryField>(entry: DefinedEntry<F>, maxLength: number): DefinedEntry<F> {
  const cut = <E extends { htmlDefinition?: string }>(shown: E): E =>
    shown.htmlDefinition === undefined ? shown : { ...shown, htmlDefinition: truncateHtml(shown.htmlDefinition, maxLength) };

  return entry.children?.length ? { ...entry, children: entry.children.map(cut) } : cut(entry);
}
