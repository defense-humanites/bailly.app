/**
 * The contract of the Bailly API (`apps/api`), as its responses go over the
 * network, shared with its client (`apps/web`): the constants both sides must
 * agree on, and the types of the requests and responses.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The entry fields a request may ask for (`fields`, `siblingsFields`): the
 * columns of the database that the API serves.
 */
export const ENTRY_FIELDS = ["word", "uri", "htmlDefinition", "definition", "htmlExcerpt", "excerpt"] as const;

/** The fields of an entry when a request names none. */
export const DEFAULT_ENTRY_FIELDS = ["word", "uri", "excerpt"] as const satisfies readonly EntryField[];

/** How a lookup query may be written (`inputMode`; the API converts it into Greek). */
export const INPUT_MODES = ["greek", "betacode", "transliteration"] as const;

/** The most URIs of a request for excerpts (`GET /entries/excerpts`). */
export const MAX_EXCERPTS_URIS = 100;

/** The longest URI of a request for excerpts, in characters. */
export const MAX_EXCERPTS_URI_LENGTH = 200;

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/** The entry fields that can be requested. */
export type EntryField = (typeof ENTRY_FIELDS)[number];

/** All the fields of an entry. */
export type EntryData = Record<EntryField, string>;

/**
 * An entry restricted to the requested fields.
 * @remarks Homonyms are grouped: the entry then only carries their common
 * `word` (its other fields are empty) and lists them as `children`.
 */
export type Entry<F extends EntryField = EntryField> = Pick<EntryData, F> & {
  children?: Pick<EntryData, F>[];
};

/** The entries before and after a given entry, in the dictionary order. */
export type Siblings<F extends EntryField = EntryField> = {
  previous?: Pick<EntryData, F>;
  next?: Pick<EntryData, F>;
};

// ---------------------------------------------------------------------------
// Morphology
// ---------------------------------------------------------------------------

/**
 * The two words of a crasis, in Greek (e.g. κἀγώ: `{ first: "καί", second:
 * "ἐγώ" }`). `second` is the form analyzed by Morpheus, whose lemma is the key
 * of the analysis.
 */
export type Crasis = {
  first: string;
  second: string;
};

/**
 * A morphological analysis (a subset of libmorpheus' `MorpheusAnalysis`, whose
 * value types are enumerations of names; read-only lists, as libmorpheus gives
 * them).
 */
export type Morphology = {
  partOfSpeech: string;
  dialects: readonly string[];
  geographicRegions: readonly string[];
  person: string | null;
  grammaticalNumber: string | null;
  genders: readonly string[];
  grammaticalCases: readonly string[];
  tense: string | null;
  mood: string | null;
  voices: readonly string[];
  degree: string | null;
  preverb: string;
  augment: string;
  morphFlags: readonly string[];
  /** Only for a crasis reading. */
  crasis?: Crasis;
};

/** Analyses grouped by key (e.g. "lemma|stem"). */
export type MorphologyGroups = Record<string, Morphology[]>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** How a lookup query is written (the API converts it into Greek). */
export type InputMode = (typeof INPUT_MODES)[number];

/** `GET /entry/:uri`. */
export type EntryParams<F extends EntryField, S extends EntryField = F> = {
  fields: F[];
  /** Also return the previous and next entries. */
  siblings?: boolean;
  /** The fields of the previous and next entries (by default, `fields`). */
  siblingsFields?: S[];
};

/** `GET /entry/random`. */
export type RandomEntryParams<F extends EntryField, S extends EntryField = F> = {
  fields: F[];
  /** The range of the definition length (in characters). */
  lengthRange?: [number, number?];
  /** Also return the previous and next entries. */
  siblings?: boolean;
  /** The fields of the previous and next entries (by default, `fields`). */
  siblingsFields?: S[];
};

/** `GET /lookup/:q`. */
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

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/**
 * A raw API response: every endpoint wraps its data in `data`, with the date of
 * the dictionary's data (`version`) and the parameters as the API read them
 * (`$query`, for diagnosis).
 */
export type ApiResponse<T> = { data: T & { version: string; $query?: Record<string, unknown> } };

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

/** `GET /entry/:uri`. An unknown entry is an empty object. */
export type ApiEntryData<F extends EntryField, S extends EntryField = F> = {
  entry: Entry<F> | Record<string, never>;
  siblings?: Siblings<S>;
};

/** `GET /entry/random`. */
export type ApiRandomEntryData<F extends EntryField, S extends EntryField = F> = {
  length: number;
  entry: Entry<F>;
  siblings?: Siblings<S>;
};

/** `GET /lookup/:q`. An invalid query gets an empty result. */
export type ApiLookupData<F extends EntryField> = {
  count: number;
  countAll: number;
  /** Analyses of the query that match no entry. */
  orphanMorphology?: MorphologyGroups;
  entries: LookupEntry<F>[];
};

/**
 * `GET /entries/excerpts?uris=…` (1 to `MAX_EXCERPTS_URIS` URIs, e.g. for the
 * bookmarks received from another device): the entries found, in the requested
 * order, and the URIs not found. A group of homonyms has no excerpt of its own:
 * `homonyms` counts its entries.
 */
export type ApiExcerptsData = {
  entries: ExcerptEntry[];
  missing: string[];
};

/** An entry of `GET /entries/excerpts`. */
export type ExcerptEntry = Pick<EntryData, "uri" | "word" | "excerpt"> & { homonyms?: number };
