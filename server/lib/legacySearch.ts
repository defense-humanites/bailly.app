import { normalizeSearchGreek } from "#shared/utils/searchGreek";

/**
 * The former search links, `/q=<Greek form>`, kept for the links from other
 * sites (notably gaffiot.fr, towards the Greek words it cites). They now lead
 * to the entry of the form or, if several entries match, to the page of the form.
 */

/**
 * The lookup parameters that vary from one attempt to the next.
 */
export type LegacyLookupOptions = {
  caseSensitive: boolean;
  diacriticSensitive: boolean;
};

/**
 * An entry found by a lookup: a headword (`isMorpheus: false`) or the lemma of
 * an inflected form (found through the morphological analysis).
 */
export type LegacyLookupEntry = {
  uri: string;
  isExact: boolean;
  isMorpheus: boolean;
};

/**
 * Looks a whole form up (exact position), with the morphological analysis.
 */
export type LegacyLookup = (form: string, options: LegacyLookupOptions) => Promise<LegacyLookupEntry[]>;

/**
 * The attempts, from the strictest to the loosest: the form as written, then
 * without its case, then without its diacritics (as the former page did).
 */
export const LEGACY_LOOKUP_ATTEMPTS: readonly LegacyLookupOptions[] = [
  { caseSensitive: true, diacriticSensitive: true },
  { caseSensitive: false, diacriticSensitive: true },
  { caseSensitive: false, diacriticSensitive: false },
];

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
 * The entries a form leads to. From the strictest attempt to the loosest,
 * the first headwords found win; without any, the lemmas of the first
 * attempt that finds some (the form is inflected).
 * @returns The entries' URIs (in the order of the API), or none.
 */
export async function resolveLegacySearch(form: string, lookup: LegacyLookup): Promise<string[]> {
  let lemmas: string[] = [];

  for (const options of LEGACY_LOOKUP_ATTEMPTS) {
    const entries = await lookup(form, options);
    const headwords = entries.filter(entry => entry.isExact && !entry.isMorpheus).map(entry => entry.uri);
    if (headwords.length) return headwords;
    if (!lemmas.length) lemmas = entries.filter(entry => entry.isMorpheus).map(entry => entry.uri);
  }

  return lemmas;
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

  return `/forme/${encodeURIComponent(form)}?q=${encodeURIComponent(uris.join(","))}`;
}
