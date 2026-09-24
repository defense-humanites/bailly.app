import type { UseFetchOptions } from "nuxt/app";
import type { OptionalKeysOf } from "~/types";
import type {
  ApiEndpointParams,
  ApiEndpointResponse,
  ApiEntryParams,
  ApiEntryResponse,
  ApiLookupParams,
  ApiLookupResponse,
  ApiRandomEntryParams,
  ApiRandomEntryResponse,
  ApiWrappedResponse,
  QueryableFields,
} from "~/plugins/api";

enum ApiEndpoint {
  Entry = "entry",
  RandomEntry = "entry/random",
  Lookup = "lookup",
}

const formatApiParams = <K extends keyof QueryableFields>(
  params: ApiEndpointParams<K> | null
): string => {
  return Object.entries(params ?? []).reduce((acc, item) => {
    let [key, value] = item;

    if (value) {
      const param = `${key}=${String(value)}`;
      return acc ? `${acc}&${param}` : param;
    }

    return acc;
  }, "");
};

export function buildApiCall<K extends keyof QueryableFields>(
  endpoint: ApiEndpoint,
  query: ApiEndpointParams<K>
): string;
export function buildApiCall<K extends keyof QueryableFields>(
  endpoint: ApiEndpoint,
  query: string,
  params?: ApiEndpointParams<K>
): string;
export function buildApiCall<K extends keyof QueryableFields>(
  endpoint: ApiEndpoint,
  queryOrParams: string | ApiEndpointParams<K>,
  params?: ApiEndpointParams<K>
): string {
  let query: string = "";
  if (typeof queryOrParams === "string") {
    query = `/${encodeURIComponent(queryOrParams)}`;
  }

  const path: string = endpoint + query;
  const request: string = formatApiParams(
    (typeof queryOrParams !== "string" ? queryOrParams : params) ?? null
  );

  return `${path}?${request}`;
}

export const useApi = <
  E extends ApiEndpointResponse<OptionalKeysOf<QueryableFields>>
>(
  url: string | (() => string),
  opts?: UseFetchOptions<ApiWrappedResponse<E>>
) => {
  return useFetch(url, {
    ...opts,
    $fetch: useNuxtApp().$api as typeof $fetch,
  });
};

export const useApiEntry = async <K extends keyof QueryableFields>(
  uri: string,
  params: ApiEntryParams<K>,
  opts?: UseFetchOptions<ApiWrappedResponse<ApiEntryResponse<K>>>
) => {
  const url = buildApiCall(ApiEndpoint.Entry, uri, params);
  return await useApi<ApiEntryResponse<K>>(url, opts);
};

export const useApiRandomEntry = async <K extends keyof QueryableFields>(
  params: ApiRandomEntryParams<K>,
  opts?: UseFetchOptions<ApiWrappedResponse<ApiRandomEntryResponse<K>>>
) => {
  const url = buildApiCall(ApiEndpoint.RandomEntry, params);
  return await useApi<ApiRandomEntryResponse<K>>(url, opts);
};

export const useApiLookup = async <K extends keyof QueryableFields>(
  betaCodeStr: string,
  params: ApiLookupParams<K>,
  opts?: UseFetchOptions<ApiWrappedResponse<ApiLookupResponse<K>>>
) => {
  const runtimeConfig = useRuntimeConfig();

  params.fields = params.fields ?? ["word", "uri", "excerpt"];
  params.morphology = params.morphology ?? false;
  params.caseSensitive = params.caseSensitive ?? false;
  params.limit = params.limit ?? +runtimeConfig.public.searchResultsLength;
  params.skipMorpheus = params.skipMorpheus ?? false;

  /*if (localStorage.getItem("searchInputMode") === "transliteration") {
      // @fixme: `greek-conversion` should implement a character exclusion list.
      searchStr = searchStr.replace(/\?/g, "§");

      searchStr = toGreek(searchStr, KeyType.TRANSLITERATION, {
        additionalChars: AdditionalChar.DIGAMMA,
        removeDiacritics: true,
        removeExtraWhitespace: true,
        transliterationStyle: {
          useCxOverMacron: true,
        },
      }).replace(/§/g, "?");
    }
  } catch (error: unknown) {
    console.error(
      `Le mode de saisie n'a pas pu être déterminé.`,
      `<${error instanceof Error ? error.message : String(error)}>`
    );
  }*/

  if (!validateInput(betaCodeStr)) return;

  const url = buildApiCall(ApiEndpoint.Lookup, betaCodeStr, params);
  const response = await useApi<ApiLookupResponse<K>>(url, opts);

  response.data.value?.data.entries.sort(
    (b, a) => Number(a.isExact) - Number(b.isExact)
  );

  return response;
};

/**
 * A. [one char] Only allow greek letters (digamma included).
 * B. (1) Allow a maximum of 50 characters.
 *    (2) Only allow greek letters (digamma included), spaces
 *        and metacharacters `^`, `$`, `?`, `*` and `"`;
 *    (3) Only allow `^` in first position;
 *    (4) Only allow `$` in last position;
 *    (5) Allow a maximum of three identical characters in a row.
 */
function validateInput(str: string): boolean {
  switch (str.length) {
    case 0:
      return false;
    case 1:
      return !/[^α-ωϝ]/i.test(str);
    default:
      return (
        str.length < 50 &&
        !/[^α-ωϝ\s^$?*"]/i.test(str) &&
        !/^.+\^/.test(str) &&
        !/\$.+$/.test(str) &&
        !/(.)\1{3,}/.test(str)
      );
  }
}
