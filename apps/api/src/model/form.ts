import type { LookupEntry } from "@bailly/api-types";
import type { Dictionary } from "../db/dictionary.ts";
import type {
  ApiFormParams,
  ApiFormResponse,
  Entry,
  QueryableFields
} from "../definitions.ts";
import type { Morpheus } from "../Morpheus.ts";
import { Settings } from "../Settings.ts";
import { getDerivedData } from "./derived.ts";
import { getEntry } from "./entry.ts";
import { getEntries } from "./lookup.ts";

/**
 * The entries a form may belong to (`GET /form/:form`), for the front end's page of
 * a form (`/forme/<form>`). They are found by the dictionary's data, never given by
 * the request: a link to that page can't make it list other entries, nor show any
 * text as a form (the former `?q=uri1,uri2` of the page did both).
 *
 *   1. A form linked in the definitions (`span[data-linked-entries]`, cf. the data
 *      converter): the entries of its links, listed in `bailly_form` by
 *      `scripts/db_derive.ts` (a form has the same entries wherever it is linked).
 *   2. Another Greek word (e.g. the former search links, `/q=<form>`, or a search
 *      sent before the page is interactive): the entries it matches as a whole
 *      word, from the strictest comparison to the loosest; without any, the lemmas
 *      of its inflected form (as the former search page did).
 */

/** The longest form looked up (the linked forms have 20 characters at most). */
export const FORM_MAX_LENGTH = 50;

/** Whether a form may be looked up as a Greek word (cf. `searchForm` in the front end). */
function isGreekWord(form: string): boolean {
  return /^[\p{Script=Greek}\p{M}]+$/u.test(form) && /\p{L}/u.test(form);
}

/** The most entries a whole-word lookup gives (as the former search page). */
const LOOKUP_LIMIT = 30;

/** The comparisons of a whole-word lookup, from the strictest to the loosest. */
const LOOKUP_ATTEMPTS = [
  { caseSensitive: true, diacriticSensitive: true },
  { caseSensitive: false, diacriticSensitive: true },
  { caseSensitive: false, diacriticSensitive: false }
] as const;

/**
 * The URIs a Greek word matches as a whole word: the first headwords found, from the
 * strictest comparison to the loosest; without any, the lemmas found by the first
 * comparison that finds some (the word is an inflected form).
 */
async function lookUpWord(
  db: Dictionary,
  morpheus: Morpheus,
  form: string
): Promise<string[]> {
  let lemmas: string[] = [];

  for (const options of LOOKUP_ATTEMPTS) {
    const { data } = await getEntries<"uri">(db, morpheus, {
      q: `"${form}"`,
      inputMode: "greek",
      fields: ["uri"],
      morphology: false,
      limit: LOOKUP_LIMIT,
      skipMorpheus: false,
      ...options
    });
    // (Empty for an invalid query: typed as such.)
    const entries = data.entries as LookupEntry<"uri">[];
    const headwords = entries
      .filter((entry) => entry.isExact && !entry.isMorpheus)
      .map((entry) => entry.uri);
    if (headwords.length) return headwords;
    if (!lemmas.length) {
      lemmas = entries.filter((entry) => entry.isMorpheus).map((entry) => entry.uri);
    }
  }

  return lemmas;
}

/** The URIs of a form: those of its links, or those it matches as a word. */
async function formUris(
  db: Dictionary,
  morpheus: Morpheus,
  form: string
): Promise<string[]> {
  if (!form || form.length > FORM_MAX_LENGTH) return [];

  if ((await getDerivedData(db)).forms) {
    const row = await db.get<{ uris: string }>(
      "SELECT uris FROM bailly_form WHERE form = ?1",
      [form]
    );
    if (row) return row.uris.split(",");
  }

  return isGreekWord(form) ? await lookUpWord(db, morpheus, form) : [];
}

/**
 * The entries a form may belong to (cf. above), with the requested fields; a group
 * of homonyms is one entry, with its `children` (as `GET /entry/:uri`).
 */
export async function getForm<K extends keyof QueryableFields>(
  db: Dictionary,
  morpheus: Morpheus,
  { form, fields }: ApiFormParams<K>
): Promise<ApiFormResponse<K>> {
  const uris = await formUris(db, morpheus, form);

  // (The lookups give a group of homonyms under its own URI, never `x#2`.)
  const entries = (await Promise.all(
    [...new Set(uris)].map((uri) => getEntry(db, { q: uri, fields, siblings: false }))
  ))
    .map(({ data }) => data.entry)
    .filter((entry): entry is Entry<K> => Object.keys(entry).length > 0);

  return {
    data: {
      version: Settings.getSettings().dbVersion,
      form,
      entries
    }
  };
}
