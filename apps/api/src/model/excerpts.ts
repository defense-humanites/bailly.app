import { Database } from "../Database.ts";
import type { ApiExcerptsResponse, ExcerptEntry } from "../definitions.ts";
import { Settings } from "../Settings.ts";

/**
 * Batch reading of excerpts (`GET /entries/excerpts?uris=…`), e.g. for bookmarks
 * synchronized from another device, which only carry their URI and word.
 *
 * The fields are fixed (`uri`, `word`, `excerpt`): hence a higher limit than a
 * generic batch (`POST /entry`).
 */

/** Maximum number of distinct URIs per request. */
export const EXCERPTS_MAX_URIS = 100;

/** Maximum length of a URI (the longest in the dictionary has 36 characters). */
export const EXCERPTS_MAX_URI_LENGTH = 200;

/** An invalid `uris` parameter (answered with a 400). */
export class ExcerptsParamError extends Error {}

/**
 * Returns the distinct URIs of the `uris` parameter (comma-separated; no URI contains
 * a comma), in the requested order. The value is already percent-decoded by Hono.
 * @throws {ExcerptsParamError} If the list is empty or too long, or if a URI is empty
 *   or too long.
 */
export function parseExcerptsUris(param: string | undefined): string[] {
  const uris = (param ?? "").split(",").map((uri) => uri.trim().normalize());

  if (uris.length === 1 && !uris[0]) {
    throw new ExcerptsParamError("The 'uris' parameter is empty");
  }
  if (uris.some((uri) => !uri)) {
    throw new ExcerptsParamError("The 'uris' parameter contains an empty URI");
  }
  if (uris.some((uri) => uri.length > EXCERPTS_MAX_URI_LENGTH)) {
    throw new ExcerptsParamError(
      `A URI exceeds ${EXCERPTS_MAX_URI_LENGTH} characters`
    );
  }

  const distinct = [...new Set(uris)];

  if (distinct.length > EXCERPTS_MAX_URIS) {
    throw new ExcerptsParamError(
      `Maximum number of URIs exceeded (${EXCERPTS_MAX_URIS})`
    );
  }

  return distinct;
}

/** The entries whose URI is requested, on the index of `uri`. */
const ENTRIES_SQL = `
  SELECT uri, word, excerpt
  FROM bailly
  WHERE uri IN (SELECT value FROM json_each($uris))
`;

/**
 * The groups of homonyms among the requested URIs: a group has no row of its own,
 * only its entries (`x#1`, `x#2`…, same word; cf. `GET /entry/:uri`). The range
 * (`x#` < uri < `x$`, `$` following `#`) selects the URIs beginning with `x#` on the
 * index of `uri`, which a `GLOB` on a computed pattern could not use.
 */
const GROUPS_SQL = `
  SELECT requested.value AS uri, MIN(bailly.word) AS word, COUNT(*) AS homonyms
  FROM json_each($uris) AS requested
  JOIN bailly
    ON bailly.uri > requested.value || '#'
   AND bailly.uri < requested.value || '$'
  WHERE substr(bailly.uri, length(requested.value) + 2) GLOB '[0-9]'
  GROUP BY requested.value
`;

/**
 * Returns the excerpt of each URI, in the requested order: `excerpt` is the plain
 * text excerpt (as `GET /entry/:uri?fields=excerpt`). Homonyms are not grouped: the
 * URI of an entry (`ho_(1)`, or `x#2` in a group) returns this entry; the URI of a
 * group returns `excerpt: ""` and its number of entries (`homonyms`). The URIs that
 * match nothing are listed in `missing`.
 */
export async function getExcerpts(uris: string[]): Promise<ApiExcerptsResponse> {
  // Not `Database.prepare()`: that cache is kept for the lookup statements, all
  // prepared at startup; this route is rarely called.
  const db = await Database.getConnection();
  const $uris = JSON.stringify(uris);

  const found = new Map<string, ExcerptEntry>();

  const entries = <ExcerptEntry[]> db.prepare(ENTRIES_SQL).all({
    $uris
  });

  for (const entry of entries) {
    found.set(entry.uri, entry);
  }

  const notFound = uris.filter((uri) => !found.has(uri));

  if (notFound.length) {
    const groups = <Required<ExcerptEntry>[]> (
      db.prepare(GROUPS_SQL).all({ $uris: JSON.stringify(notFound) })
    );

    for (const { uri, word, homonyms } of groups) {
      found.set(uri, { uri, word, excerpt: "", homonyms });
    }
  }

  return {
    data: {
      version: Settings.getSettings().dbVersion,
      entries: uris
        .map((uri) => found.get(uri))
        .filter((entry): entry is ExcerptEntry => entry !== undefined),
      missing: uris.filter((uri) => !found.has(uri))
    }
  };
}
