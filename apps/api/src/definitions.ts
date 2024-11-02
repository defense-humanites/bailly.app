import type { KeyType } from "greek-conversion";

export type NonEmptyArray<T> = [T, ...T[]];

export type Optional<T, K extends keyof T> = { [P in K]?: T[K] };

export type PartialExcept<T, K extends keyof T> = Pick<T, K> &
  Partial<Omit<T, K>>;

export type ApiRawParams = {
  q?: string;
  inputMode?: "greek" | "betacode" | "transliteration" | string;
  fields?: string;
  morphology?: string;
  caseSensitive?: string;
  lengthRange?: string;
  limit?: string;
  offset?: string;
  siblings?: string;
  skipMorpheus?: string;
};

export type ApiParams<K extends keyof QueryableFields> = {
  q: string;
  inputMode: KeyType;
  fields: NonEmptyArray<keyof Pick<QueryableFields, K>>;
  morphology: boolean;
  caseSensitive: boolean;
  lengthRange: [number, number?] | null;
  limit?: number;
  offset?: number;
  siblings: boolean;
  skipMorpheus: boolean;
};

export type ApiEntryParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  "q" | "fields" | "siblings"
>;
export type ApiLookupParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  | "q"
  | "inputMode"
  | "fields"
  | "morphology"
  | "caseSensitive"
  | "limit"
  | "skipMorpheus"
>;
export type ApiRandomEntryParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  "fields" | "lengthRange"
>;

export type ApiResponse = {
  data: {
    version: string;
  };
};

export interface ApiEntryResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  data: {
    version: string;
    entry: PartialExcept<Entry<K>, K | "children">;
    siblings: Siblings<K>;
  };
}

export interface ApiRandomEntryResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  data: {
    version: string;
    length: number;
    entry: PartialExcept<Entry<K>, K | "children">;
  };
}

export interface ApiLookupResponse<K extends keyof QueryableFields>
  extends ApiResponse {
  data: {
    version: string;
    count: number;
    countAll: number;
    morphology?: MorpheusData;
    entries: PartialExcept<
      Entry<K>,
      K | "children" | "isExact" | "isMorpheus"
    >[];
  };
}

export type DatabaseEntry = {
  countAll: number;
  orderedID: number;
  word: string;
  uri: string;
  searchable: string;
  searchableCaseInsensitive: string;
  searchableAtonic: string;
  searchableAtonicCaseInsensitive: string;
  htmlDefinition: string;
  definition: string;
  htmlExcerpt: string;
  excerpt: string;
};

export type Entry<K extends keyof Entry = never> = {
  orderedID: number;
  word: string;
  uri: string;
  htmlDefinition: string;
  definition: string;
  htmlExcerpt: string;
  excerpt: string;
  isExact: boolean;
  isMorpheus: boolean;
  children?: PartialExcept<Entry, K>[];
};

export type QueryableFields = Pick<
  Entry,
  "word" | "uri" | "htmlDefinition" | "definition" | "htmlExcerpt" | "excerpt"
>;

export type Siblings<K extends keyof QueryableFields> = {
  previous?: PartialExcept<Entry<K>, K>;
  next?: PartialExcept<Entry<K>, K>;
};

export type EntryWithSiblings<K extends keyof QueryableFields> = {
  entry: PartialExcept<Entry<K>, K>;
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
