import type {
  ApiEntryData,
  ApiLookupData,
  ApiRandomEntryData,
  ApiResponse,
  Entry,
  EntryField,
  EntryParams,
  LookupEntry,
  LookupParams,
  MorphologyGroups,
  RandomEntryParams,
  Siblings,
} from "#shared/types/api";
import { sortLookupEntries, toApiQuery } from "#shared/utils/api";

export type EntryResult<F extends EntryField, S extends EntryField = F> = {
  /** The entry, or `null` if it doesn't exist. */
  entry: Entry<F> | null;
  siblings: Siblings<S>;
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
    }),
  });
}

/**
 * Fetches several entries (reactive to `uris`), e.g. for the reader.
 * @param uris The entries' URIs.
 * @param params The requested fields.
 * @returns The found entries, in the requested order, and the URIs of the
 * missing ones.
 */
export function useApiEntries<F extends EntryField>(
  uris: MaybeRefOrGetter<string[]>,
  params: Omit<EntryParams<F>, "siblings" | "siblingsFields">,
) {
  const { $api } = useNuxtApp();

  return useAsyncData(
    () => `entries:${toValue(uris).join(",")}`,
    async (): Promise<{ entries: Entry<F>[]; missing: string[] }> => {
      const requested = toValue(uris);
      const responses = await Promise.all(requested.map(uri =>
        $api<ApiResponse<ApiEntryData<F>>>(`entry/${encodeURIComponent(uri)}`, { query: toApiQuery(params) }),
      ));
      // The API answers unknown entries with an empty object.
      const entries = responses.map(({ data }) => Object.keys(data.entry).length ? data.entry as Entry<F> : null);
      return {
        entries: entries.filter((entry): entry is Entry<F> => entry !== null),
        missing: requested.filter((_, index) => entries[index] === null),
      };
    },
  );
}

/**
 * Fetches a random entry.
 * @param params The requested fields and options.
 */
export function useApiRandomEntry<F extends EntryField>(params: RandomEntryParams<F>) {
  return useFetch("entry/random", {
    $fetch: useNuxtApp().$api,
    query: toApiQuery(params),
    transform: ({ data }: ApiResponse<ApiRandomEntryData<F>>): Entry<F> => data.entry,
  });
}

/**
 * Returns a function that looks entries up, e.g. for a search as you type.
 * @remarks The API validates the query: an invalid one gets an empty result.
 */
export function useApiLookup() {
  const { $api, $config } = useNuxtApp();

  return async <F extends EntryField>(
    query: string,
    params: LookupParams<F>,
  ): Promise<LookupResult<F>> => {
    const q = query.trim();
    if (!q) return { count: 0, countAll: 0, orphanMorphology: {}, entries: [] };

    const { data } = await $api<ApiResponse<ApiLookupData<F>>>(`lookup/${encodeURIComponent(q)}`, {
      query: toApiQuery({ limit: $config.public.searchResultsLength, ...params }),
    });

    return {
      count: data.count,
      countAll: data.countAll,
      orphanMorphology: data.orphanMorphology ?? {},
      entries: sortLookupEntries(data.entries),
    };
  };
}
