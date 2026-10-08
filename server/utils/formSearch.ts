import type { H3Event } from "h3";
import { createError, sendRedirect } from "h3";
import type { ApiLookupData, ApiResponse, LookupParams } from "#shared/types/api";
import { toApiQuery } from "#shared/utils/api";
import { legacySearchLocation, resolveLegacySearch, type LegacyLookup } from "../lib/legacySearch";

/**
 * The page a searched form is not found on (or a path that isn't a search).
 * @param form The form (normalized), or `null` if it isn't a Greek word.
 */
export function formNotFound(form: string | null) {
  return createError({
    statusCode: 404,
    statusMessage: "Not Found",
    message: form ? `Aucune entrée ne correspond à « ${form} ».` : "La page demandée n'existe pas.",
  });
}

/**
 * Redirects a search for a whole Greek form (cf. `searchForm`) to the entry
 * of the form, or to the form's page if several entries match (cf.
 * `server/lib/legacySearch.ts`). A 302: the answer depends on the
 * dictionary's data and on the search.
 */
export async function redirectToForm(event: H3Event, form: string) {
  const { apiHost } = useRuntimeConfig(event).public;
  const lookup: LegacyLookup = async (query, options) => {
    const { data } = await $fetch<ApiResponse<ApiLookupData<"uri">>>(`lookup/${encodeURIComponent(`"${query}"`)}`, {
      baseURL: apiHost,
      query: toApiQuery({
        fields: ["uri"],
        inputMode: "greek",
        skipMorpheus: false,
        limit: 30,
        ...options,
      } satisfies LookupParams<"uri">),
    });
    return data.entries;
  };

  let uris: string[];
  try {
    uris = await resolveLegacySearch(form, lookup);
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Bad Gateway", message: "Le dictionnaire n'a pas pu être consulté." });
  }

  if (!uris.length) throw formNotFound(form);
  return sendRedirect(event, legacySearchLocation(form, uris), 302);
}
