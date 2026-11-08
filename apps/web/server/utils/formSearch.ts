import type { H3Event } from "h3";
import { createError, sendRedirect } from "h3";
import type { ApiFormData, ApiResponse, FormParams } from "#shared/types/api";
import { toApiQuery } from "#shared/utils/api";
import { apiBinding, createApiFetch, serverApiHost } from "#shared/utils/apiBinding";
import { legacySearchLocation } from "../lib/legacySearch";

/**
 * The page a searched form is not found on (or a path that isn't a search).
 * @param form The form (normalized), or `null` if it isn't a Greek word.
 */
export function formNotFound(form: string | null) {
  return createError({
    statusCode: 404,
    statusMessage: "Not Found",
    message: form ? `Aucune entrée ne correspond à «\u00a0${form}\u00a0».` : "La page demandée n'existe pas.",
  });
}

/**
 * Redirects a search for a whole Greek form (cf. `searchForm`) to the entry
 * of the form, or to the form's page if several entries match (cf.
 * `server/lib/legacySearch.ts`), as the API finds them (`GET /form/:form`,
 * one request). A 302: the answer depends on the dictionary's data and on
 * the search.
 */
export async function redirectToForm(event: H3Event, form: string) {
  const apiHost = serverApiHost(useRuntimeConfig(event));
  // Through the API Worker's service binding on Cloudflare (cf. `apiBinding`).
  const api = createApiFetch(apiHost, apiBinding(event));

  let uris: string[];
  try {
    const { data } = await api<ApiResponse<ApiFormData<"uri">>>(`form/${encodeURIComponent(form)}`, {
      query: toApiQuery({ fields: ["uri"] } satisfies FormParams<"uri">),
    });
    uris = data.entries.map(entry => entry.uri);
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Bad Gateway", message: "Le dictionnaire n'a pas pu être consulté." });
  }

  if (!uris.length) throw formNotFound(form);
  return sendRedirect(event, legacySearchLocation(form, uris), 302);
}
