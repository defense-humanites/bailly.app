export type ApiParams<K extends keyof QueryableFields> = {
  fields: (keyof Pick<QueryableFields, K>)[];
  morphology?: boolean;
  caseSensitive?: boolean;
  lengthRange?: [number, number?];
  limit?: number;
  offset?: number;
  siblings?: boolean;
  skipMorpheus?: boolean;
};

export type ApiEndpointParams<K extends keyof QueryableFields> =
  | ApiEntryParams<K>
  | ApiLookupParams<K>
  | ApiRandomEntryParams<K>;

export type ApiEntryParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  "fields" | "siblings"
>;
export type ApiLookupParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  "fields" | "morphology" | "caseSensitive" | "limit" | "skipMorpheus"
>;
export type ApiRandomEntryParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  "fields" | "lengthRange"
>;

type ApiResponse = {
  version: string;
};

export type ApiEndpointResponse<K extends keyof QueryableFields> =
  | ApiEntryResponse<K>
  | ApiRandomEntryResponse<K>
  | ApiLookupResponse<K>;

export type ApiWrappedResponse<
  T extends ApiEndpointResponse<K>,
  K extends keyof QueryableFields = never
> = { data: T };

export interface ApiEntryResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  entry: Entry<K>;
  siblings: Siblings<K>;
}

export interface ApiRandomEntryResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  length: number;
  entry: Entry<K>;
}

export interface ApiLookupResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  count: number;
  countAll: number;
  morphology?: MorpheusData;
  entries: Entry<K | "isExact" | "isMorpheus">[];
}

type EntryBase = {
  word: string;
  uri: string;
  htmlDefinition: string;
  definition: string;
  htmlExcerpt: string;
  excerpt: string;
  isExact?: boolean;
  isMorpheus?: boolean;
};

type PickEntryBase<K extends keyof EntryBase> = Pick<EntryBase, K>;

export type Entry<K extends keyof EntryBase = keyof EntryBase> =
  PickEntryBase<K> & {
    children?: PickEntryBase<K>[];
  };

export type QueryableFields = Pick<
  Entry,
  "word" | "uri" | "htmlDefinition" | "definition" | "htmlExcerpt" | "excerpt"
>;

export type Siblings<K extends keyof QueryableFields> = {
  previous?: Entry<K>;
  next?: Entry<K>;
};

export type EntryWithSiblings<K extends keyof QueryableFields> = {
  entry: Entry<K>;
  siblings: Siblings<K>;
};

export type MorpheusData = {
  [lemma: string]: MorpheusDataItem[];
};

export type MorpheusDataItem = {
  workw: string;
  lem: string;
  prvb: string;
  aug1: string;
  stem: string;
  suff: string;
  end: string;
};

// Cf. https://nuxt.com/docs/4.x/guide/recipes/custom-usefetch
export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();

  const api = $fetch.create({
    baseURL: runtimeConfig.public.apiHost,
  });

  return {
    provide: {
      api,
    },
  };
});
