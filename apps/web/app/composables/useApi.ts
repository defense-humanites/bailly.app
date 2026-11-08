import type {
  ApiEntryData,
  ApiFormData,
  ApiLookupData,
  ApiResponse,
  Entry,
  EntryField,
  EntryParams,
  FormParams,
  LookupEntry,
  LookupParams,
  MorphologyGroups,
  Siblings,
} from "#shared/types/api";
import { sortLookupEntries, toApiQuery } from "#shared/utils/api";

export type EntryResult<F extends EntryField, S extends EntryField = F> = {
  /** The entry, or `null` if it doesn't exist. */
  entry: Entry<F> | null;
  siblings: Siblings<S>;
  /** The version of the data (`YYYY-MM-DD`, e.g. for a citation). */
  version?: string;
};

export type LookupResult<F extends EntryField> = {
  count: number;
  countAll: number;
  orphanMorphology: MorphologyGroups;
  /** The entries, exact matches first. */
  entries: LookupEntry<F>[];
};

/**
 * Fetches an entry (reactive to `uri`).
 * @param uri The entry URI.
 * @param params The requested fields and options.
 */
export function useApiEntry<F extends EntryField, S extends EntryField = F>(
  uri: MaybeRefOrGetter<string>,
  params: EntryParams<F, S>,
) {
  return useFetch(() => `entry/${encodeURIComponent(toValue(uri))}`, {
    $fetch: useNuxtApp().$api,
    query: toApiQuery(params),
    transform: ({ data }: ApiResponse<ApiEntryData<F, S>>): EntryResult<F, S> => ({
      // The API answers unknown entries with an empty object.
      entry: Object.keys(data.entry).length ? (data.entry as Entry<F>) : null,
      siblings: data.siblings ?? {},
      version: data.version,
    }),
  });
}

/**
 * Fetches the entries a form may belong to (reactive to `form`), for the
 * form's page: found by the dictionary's data (the entries of the form's
 * links in the definitions, or those it matches as a whole word), never
 * given by the page's address.
 * @param form The form.
 * @param params The requested fields.
 * @returns The entries (none for an unknown form), in the API's order.
 */
export function useApiForm<F extends EntryField>(
  form: MaybeRefOrGetter<string>,
  params: FormParams<F>,
) {
  return useFetch(() => `form/${encodeURIComponent(toValue(form))}`, {
    $fetch: useNuxtApp().$api,
    query: toApiQuery(params),
    transform: ({ data }: ApiResponse<ApiFormData<F>>): Entry<F>[] => data.entries,
  });
}

/**
 * Returns a function that looks entries up, e.g. for a search as you type.
 * @remarks The API validates the query: an invalid one gets an empty result.
 * A `signal` cancels the request (e.g. a newer query).
 */
export function useApiLookup() {
  const { $api, $config } = useNuxtApp();

  return async <F extends EntryField>(
    query: string,
    params: LookupParams<F>,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<LookupResult<F>> => {
    const q = query.trim();
    if (!q) return { count: 0, countAll: 0, orphanMorphology: {}, entries: [] };

    const { data } = await $api<ApiResponse<ApiLookupData<F>>>(`lookup/${encodeURIComponent(q)}`, {
      query: toApiQuery({ limit: $config.public.searchResultsLength, ...params }),
      signal,
    });

    return {
      count: data.count,
      countAll: data.countAll,
      orphanMorphology: data.orphanMorphology ?? {},
      entries: sortLookupEntries(data.entries),
    };
  };
}
