/**
 * Types of the Bailly API (cf. `src/definitions.ts` in the bailly-api repository).
 */

/**
 * The entry fields that can be requested.
 */
export type EntryField = "word" | "uri" | "htmlDefinition" | "definition" | "htmlExcerpt" | "excerpt";

/**
 * All the fields of an entry.
 */
export type EntryData = Record<EntryField, string>;

/**
 * An entry restricted to the requested fields.
 * @remarks Homonyms are grouped: the entry then only carries their common
 * `word` (its other fields are empty) and lists them as `children`.
 */
export type Entry<F extends EntryField = EntryField> = Pick<EntryData, F> & {
  children?: Pick<EntryData, F>[];
};

/**
 * The entries before and after a given entry, in the dictionary order.
 */
export type Siblings<F extends EntryField = EntryField> = {
  previous?: Pick<EntryData, F>;
  next?: Pick<EntryData, F>;
};

/**
 * A morphological analysis (a subset of libmorpheus' `MorpheusAnalysis`, whose
 * value types are enumerations of names).
 */
export type Morphology = {
  partOfSpeech: string;
  dialects: string[];
  geographicRegions: string[];
  person: string | null;
  grammaticalNumber: string | null;
  genders: string[];
  grammaticalCases: string[];
  tense: string | null;
  mood: string | null;
  voices: string[];
  degree: string | null;
  preverb: string;
  augment: string;
  morphFlags: string[];
};

/**
 * Analyses grouped by key (e.g. "lemma|stem").
 */
export type MorphologyGroups = Record<string, Morphology[]>;

/**
 * An entry found by a lookup.
 * @remarks An entry found through its inflected form (`isMorpheus`) is also
 * an exact match (`isExact`).
 */
export type LookupEntry<F extends EntryField = EntryField> = Entry<F> & {
  isExact: boolean;
  isMorpheus: boolean;
  morphology?: MorphologyGroups;
};

/**
 * How a lookup query is written (the API converts it into Greek).
 */
export type InputMode = "greek" | "betacode" | "transliteration";

export type EntryParams<F extends EntryField, S extends EntryField = F> = {
  fields: F[];
  /** Also return the previous and next entries. */
  siblings?: boolean;
  /** The fields of the previous and next entries (by default, `fields`). */
  siblingsFields?: S[];
};

export type RandomEntryParams<F extends EntryField> = {
  fields: F[];
  /** The range of the definition length (in characters). */
  lengthRange?: [number, number?];
};

export type LookupParams<F extends EntryField> = {
  fields: F[];
  inputMode?: InputMode;
  /** Also return the morphological analyses. */
  morphology?: boolean;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
  limit?: number;
  /** Don't look inflected forms up. */
  skipMorpheus?: boolean;
};

/**
 * A raw API response: every endpoint wraps its data in `data`.
 */
export type ApiResponse<T> = { data: T & { version: string } };

/**
 * `GET /entry/:uri`. An unknown entry is an empty object.
 */
export type ApiEntryData<F extends EntryField, S extends EntryField = F> = {
  entry: Entry<F> | Record<string, never>;
  siblings?: Siblings<S>;
};

/**
 * `GET /entry/random`.
 */
export type ApiRandomEntryData<F extends EntryField> = {
  length: number;
  entry: Entry<F>;
};

/**
 * `GET /lookup/:q`. An invalid query gets an empty result.
 */
export type ApiLookupData<F extends EntryField> = {
  count: number;
  countAll: number;
  /** Analyses of the query that match no entry. */
  orphanMorphology?: MorphologyGroups;
  entries: LookupEntry<F>[];
};

/**
 * `GET /entries/excerpts?uris=…` (1 to `MAX_EXCERPTS_URIS` URIs, e.g. for the
 * bookmarks received from another device): the entries found, in the
 * requested order, and the URIs not found. A group of homonyms has no excerpt
 * of its own: `homonyms` counts its entries.
 */
export type ApiExcerptsData = {
  entries: (Pick<EntryData, "uri" | "word" | "excerpt"> & { homonyms?: number })[];
  missing: string[];
};
