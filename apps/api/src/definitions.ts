import type { Format as GreekConversionFormat } from "@humanities/greek-conversion";
import type { MorpheusResponse, Morphology } from "./Morpheus.ts";

export type NonEmptyArray<T> = [T, ...T[]];

export type Optional<T, K extends keyof T> = { [P in K]?: T[K] };

export type PartialExcept<T, K extends keyof T> =
  & Pick<T, K>
  & Partial<Omit<T, K>>;

export type GreekConversionFormatKey = GreekConversionFormat;

export type ApiParams<K extends keyof QueryableFields> = {
  q: string;
  inputMode: GreekConversionFormatKey;
  fields: NonEmptyArray<keyof Pick<QueryableFields, K>>;
  morphology: boolean;
  caseSensitive: boolean;
  diacriticSensitive: boolean;
  lengthRange: [number, number?] | null;
  limit?: number;
  offset?: number;
  siblings: boolean;
  /** Fields of the siblings (`siblings=true`); `fields` by default. */
  siblingsFields?: NonEmptyArray<keyof QueryableFields>;
  skipMorpheus: boolean;
};

export type ApiEntryParams<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> =
  & Pick<ApiParams<K>, "q" | "fields" | "siblings">
  & { siblingsFields?: NonEmptyArray<keyof Pick<QueryableFields, S>> };
export type ApiLookupParams<K extends keyof QueryableFields> = Pick<
  ApiParams<K>,
  | "q"
  | "inputMode"
  | "fields"
  | "morphology"
  | "caseSensitive"
  | "diacriticSensitive"
  | "limit"
  | "skipMorpheus"
>;
export type ApiRandomEntryParams<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> =
  & Pick<ApiParams<K>, "fields" | "lengthRange">
  & Partial<Pick<ApiParams<K>, "siblings">>
  & { siblingsFields?: NonEmptyArray<keyof Pick<QueryableFields, S>> };

export type ApiResponse = {
  data: {
    version: string;
  };
};

export interface ApiEntryResponse<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> extends ApiResponse {
  data: {
    version: string;
    entry: PartialExcept<Entry<K>, K | "children">;
    siblings: Siblings<S>;
  };
}

export interface ApiRandomEntryResponse<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> extends ApiResponse {
  data: {
    version: string;
    length: number;
    entry: PartialExcept<Entry<K>, K | "children">;
    /** Only with `siblings=true`: those of `GET /entry/:uri` for the drawn entry. */
    siblings?: Siblings<S>;
  };
}

export interface ApiLookupResponse<
  K extends keyof QueryableFields
> extends ApiResponse {
  data: {
    version: string;
    count: number;
    countAll: number;
    orphanMorphology?: MorpheusResponse<Morphology>;
    entries: PartialExcept<
      Entry<K>,
      K | "children" | "isExact" | "isMorpheus" | "morphology"
    >[];
  };
}

/** An entry of `GET /entries/excerpts`; `homonyms` only for a group of homonyms. */
export type ExcerptEntry = Pick<Entry, "uri" | "word" | "excerpt"> & {
  homonyms?: number;
};

export interface ApiExcerptsResponse extends ApiResponse {
  data: {
    version: string;
    entries: ExcerptEntry[];
    missing: string[];
  };
}

export type DatabaseEntry = {
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
  morphology?: MorpheusResponse<Morphology>;
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
