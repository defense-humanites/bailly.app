import type * as Contract from "@bailly/api-types";
import type { Format as GreekConversionFormat } from "./greek.ts";
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

/*
 * The responses, as they go over the network: the contract shared with the front
 * end (`@bailly/api-types`), which they must satisfy.
 */
export type ApiResponse = { data: { version: string } };

export type ApiEntryResponse<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> = Contract.ApiResponse<Contract.ApiEntryData<K, S>>;

export type ApiRandomEntryResponse<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
> = Contract.ApiResponse<Contract.ApiRandomEntryData<K, S>>;

export type ApiLookupResponse<K extends keyof QueryableFields> = Contract.ApiResponse<
  Contract.ApiLookupData<K>
>;

export type ExcerptEntry = Contract.ExcerptEntry;

export type ApiExcerptsResponse = Contract.ApiResponse<Contract.ApiExcerptsData>;

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

/** The fields a request may ask for (`ENTRY_FIELDS` of the contract). */
export type QueryableFields = Pick<Entry, Contract.EntryField>;

export type Siblings<K extends keyof QueryableFields> = {
  previous?: PartialExcept<Entry<K>, K>;
  next?: PartialExcept<Entry<K>, K>;
};

export type EntryWithSiblings<K extends keyof QueryableFields> = {
  entry: PartialExcept<Entry<K>, K>;
  siblings: Siblings<K>;
};
