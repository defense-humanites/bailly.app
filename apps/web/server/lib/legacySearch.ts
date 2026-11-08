import { normalizeSearchGreek } from "#shared/utils/searchGreek";

/**
 * The former search links, `/q=<Greek form>`, kept for the links from other
 * sites (notably gaffiot.fr, towards the Greek words it cites). They now lead
 * to the entry of the form or, if several entries match, to the page of the
 * form; the API finds its entries (`GET /form/:form`: those of its links in
 * the definitions, or those it matches as a whole word, from the strictest
 * comparison to the loosest, else the lemmas of its inflected form).
 */

/**
 * The longest form accepted.
 */
const MAX_FORM_LENGTH = 50;

/**
 * The former search path.
 */
const LEGACY_PATH = /^\/q=([^/]*)\/?$/;

/**
 * The Greek form of a former search path.
 * @param path The request path (without its query), percent-encoded or not.
 * @returns `undefined` if it isn't a former search path; `null` if the form
 * isn't a Greek word; otherwise the form, normalized (NFC, letter variants,
 * final sigma), with its diacritics.
 * @example legacySearchForm("/q=%CE%BB%CF%8C%CE%B3%CE%BF%CF%82") // "λόγος"
 */
export function legacySearchForm(path: string): string | null | undefined {
  const match = LEGACY_PATH.exec(path);
  if (!match) return undefined;

  let form: string;
  try {
    form = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }

  return searchForm(form);
}

/**
 * A Greek form to look up as a whole (cf. `resolveLegacySearch`).
 * @returns The form, normalized (NFC, letter variants, final sigma), with
 * its diacritics; `null` if it isn't a Greek word (or is too long).
 */
export function searchForm(input: string): string | null {
  const form = normalizeSearchGreek(input.trim());
  return form.length <= MAX_FORM_LENGTH && /^[\p{Script=Greek}\p{M}]+$/u.test(form) && /\p{L}/u.test(form)
    ? form
    : null;
}

/**
 * Where a former search leads: the page of its entry (a group of homonyms
 * being one entry; a homonym, to its anchor) or, for several entries, the
 * form's page.
 * @param uris The entries' URIs (at least one).
 */
export function legacySearchLocation(form: string, uris: readonly string[]): string {
  if (uris.length === 1) {
    const [, uri, homonym] = /^(.*?)(?:#(\d+))?$/.exec(uris[0]!)!;
    return `/${encodeURIComponent(uri!)}${homonym ? `#${homonym}` : ""}`;
  }

  return `/forme/${encodeURIComponent(form)}`;
}
