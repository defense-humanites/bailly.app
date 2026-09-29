import { createError, getRequestURL, sendRedirect } from "h3";
import type { ApiLookupData, ApiResponse, LookupParams } from "#shared/types/api";
import { toApiQuery } from "#shared/utils/api";
import { legacySearchForm, legacySearchLocation, resolveLegacySearch, type LegacyLookup } from "../lib/legacySearch";

/**
 * Redirects the former search links (`/q=<Greek form>`, e.g. from gaffiot.fr)
 * to the entry of the form, or to the reader if several entries match
 * (cf. `server/lib/legacySearch.ts`). A 302: the answer depends on the
 * dictionary's data and on the search.
 */
export default defineEventHandler(async (event) => {
  const form = legacySearchForm(getRequestURL(event).pathname);
  if (form === undefined) return;

  const notFound = () => createError({
    statusCode: 404,
    statusMessage: "Not Found",
    message: form ? `Aucune entrée ne correspond à « ${form} ».` : "La page demandée n'existe pas.",
  });
  if (form === null) throw notFound();

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

  if (!uris.length) throw notFound();
  return sendRedirect(event, legacySearchLocation(form, uris), 302);
});
