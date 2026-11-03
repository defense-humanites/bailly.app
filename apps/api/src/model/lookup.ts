import type { Dictionary, SqlStatement, SqlValue } from "../db/dictionary.ts";
import type {
  ApiLookupParams,
  ApiLookupResponse,
  DatabaseEntry,
  Entry,
  PartialExcept,
  QueryableFields
} from "../definitions.ts";
import { SpecialChar } from "../enums.ts";
import {
  getCrasis,
  type Morpheus,
  type MorpheusAnalysis,
  type MorpheusResponse,
  type Morphology
} from "../Morpheus.ts";
import { queryToGreek } from "../greek.ts";
import { toBaillySearchKey, toSearchKey } from "../searchKey.ts";
import { Settings } from "../Settings.ts";
import {
  type DerivedData,
  getDerivedData,
  PREFIX_COUNT_MAX_LENGTH,
  reverseKey,
  reversedColumn,
  SEARCH_COLUMNS,
  type SearchColumn
} from "./derived.ts";

const LookupMode = {
  exact: 0,
  startsWith: 1,
  endsWith: 2
} as const;

type LookupMode = typeof LookupMode[keyof typeof LookupMode];

type QueryStringFormat = {
  searchStr: string;
  surfaceForm: string;
  lookupMode: LookupMode;
};

type MatchFlags = {
  directMatch: number;
  morpheusMatch: number;
};

type MatchedDatabaseEntry =
  & PartialExcept<DatabaseEntry, "word">
  & MatchFlags;

/**
 * An entry being processed by the lookup: a matched row (or several rows grouped
 * under a common entry), which keeps its internal fields (`searchable*`, match
 * flags, etc.) until the response is formatted.
 */
type LookupEntry =
  & Pick<DatabaseEntry, "word">
  & Partial<Omit<DatabaseEntry, "word">>
  & Partial<MatchFlags>
  & Partial<Pick<Entry, "morphology">>
  & { children?: LookupEntry[] };

type LookupResponse = {
  data: Omit<ApiLookupResponse<never>["data"], "entries"> & {
    entries: LookupEntry[];
  };
};

type MorphologyKey = {
  lemma: string;
  stem: string;
};

function getMorphology({
  partOfSpeech,
  dialects,
  geographicRegions,
  person,
  grammaticalNumber,
  genders,
  grammaticalCases,
  tense,
  mood,
  voices,
  degree,
  preverb,
  augment,
  morphFlags,
  crasis,
  workword
}: MorpheusAnalysis): Morphology {
  const crasisWords = getCrasis({ crasis, workword });

  return {
    partOfSpeech,
    dialects,
    geographicRegions,
    person,
    grammaticalNumber,
    genders,
    grammaticalCases,
    tense,
    mood,
    voices,
    degree,
    preverb,
    augment,
    morphFlags,
    // Only for a crasis reading (e.g. ὦγαθε: ὦ + ἀγαθέ), so that the front end can
    // tell it apart.
    ...(crasisWords && { crasis: crasisWords })
  };
}

function parseMorphologyKey(key: string): MorphologyKey | undefined {
  const separatorIndex = key.indexOf("|");
  if (separatorIndex === -1) return undefined;

  return {
    lemma: key.slice(0, separatorIndex),
    stem: key.slice(separatorIndex + 1)
  };
}

// @fixme this would make sense if an option 'permissive: boolean' is added to the API.
// (The quantity marks are already removed by the search key.)
function sanitizeGreek(word: string): string {
  return word.replace(/[·•]/g, "");
}

/**
 * Returns the search key of a query (or of a Morpheus lemma), as stored in the
 * searchable* columns: both are computed by `@humanities/bailly-search-key` (which
 * also handles the contract-verb suffix "-ῶ", the graves and τὶς).
 */
function formatSearchableValue(
  value: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): string {
  const formatted = toBaillySearchKey(value, { caseSensitive, diacriticSensitive });

  // @fixme Add this option to the API?
  const permissive = false;
  return permissive ? sanitizeGreek(formatted) : formatted;
}

function formatQueryStr(
  q: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): QueryStringFormat {
  q = q.replace(/^"/, SpecialChar.explicitStart);
  q = q.replace(/"$/, SpecialChar.explicitEnd);

  let lookupMode: LookupMode;

  if (
    q.startsWith(SpecialChar.explicitStart) &&
    q.endsWith(SpecialChar.explicitEnd)
  ) {
    q = q.slice(1, -1).replace(/^[*]+|[*]+$/g, "");
    lookupMode = LookupMode.exact;
  } else if (q.startsWith(SpecialChar.explicitStart)) {
    q = q.slice(1);
    lookupMode = LookupMode.endsWith;
  } else if (q.endsWith(SpecialChar.explicitEnd)) {
    q = q.slice(0, -1);
    lookupMode = LookupMode.startsWith;
  } else {
    lookupMode = LookupMode.endsWith;
  }

  const surfaceForm = q.trim();

  return {
    searchStr: formatSearchableValue(
      surfaceForm,
      caseSensitive,
      diacriticSensitive
    ),
    surfaceForm,
    lookupMode
  };
}

function formatSearchableField(
  caseSensitive: boolean,
  diacriticSensitive: boolean
): SearchColumn {
  return `searchable${diacriticSensitive ? "" : "Atonic"}${
    caseSensitive ? "" : "CaseInsensitive"
  }` as SearchColumn;
}

/**
 * The selected fields in a canonical order (that of `QUERY_ALLOWED_FIELDS`), `word`
 * included: the SQL text then only depends on the *set* of requested fields, which
 * bounds the number of statement variants (cf. `preloadLookupStatements()`).
 */
function canonicalFields(fields: readonly string[]): string[] {
  const requested = new Set([...fields, "word"]);
  const allowed = Settings.getSettings().queryAllowedFields;

  return [
    ...(allowed.includes("word") ? [] : ["word"]),
    ...allowed.filter((field) => requested.has(field))
  ];
}

/**
 * How the query matches the search column, by the shape of its pattern. Every kind
 * but `pattern` is written without `GLOB`: D1 refuses a `LIKE` or `GLOB` pattern
 * longer than 50 bytes (25 Greek letters: 18 headwords are longer), and a range
 * on the index is what SQLite makes of a prefix `GLOB` anyway.
 *
 *   - `equals`: the exact mode without wildcards (`"λογος"`);
 *   - `prefix`: `λογ*` (the default mode), an index range;
 *   - `suffix`: `*λογος`, a range on the reversed keys when the data has them (cf.
 *     `scripts/db_derive.ts`), the end of the key otherwise;
 *   - `contains`: `*λογ*`;
 *   - `pattern`: anything with `?` or an inner `*`, by `GLOB`, at most
 *     `PATTERN_MAX_BYTES` (cf. `getEntries()`).
 */
type MatchKind = "equals" | "prefix" | "suffix" | "contains" | "pattern";

const MATCH_KINDS: readonly MatchKind[] = [
  "equals",
  "prefix",
  "suffix",
  "contains",
  "pattern"
];

/** The longest `GLOB` pattern D1 accepts, in UTF-8 bytes. */
const PATTERN_MAX_BYTES = 50;

function getMatchKind(query: string, exact: boolean): MatchKind {
  if (exact) return "equals";
  if (/^[^*?]+\*$/.test(query)) return "prefix";
  if (/^\*[^*?]+$/.test(query)) return "suffix";
  if (/^\*[^*?]+\*$/.test(query)) return "contains";
  return "pattern";
}

/**
 * The parameters of the lookup statements, the same for all of them: each statement
 * receives the values up to the highest number it uses (D1 wants exactly as many),
 * so that its SQL text only depends on the search column, the kind of match, the
 * set of fields and the variant (a closed set, prepared at startup).
 *
 *   ?1 the text matched (the query without its outer `*`), or the `GLOB` pattern;
 *   ?2 the search key of an exact match (`null`: none possible);
 *   ?3 the search keys (`searchable`) of the Morpheus lemmas, as a JSON array;
 *   ?4 the limit (`-1`: none);
 *   ?5 the rows out of index order (`ordered` variant), as a JSON array;
 *   ?6 the end of a prefix range: the text with its last character incremented;
 *   ?7, ?8 the same range on the reversed keys (`suffix`).
 */
type LookupParams = [
  text: string,
  exactQuery: string | null,
  morpheusSearchableKeys: string,
  limit: number,
  unordered: string | null,
  textEnd: string | null,
  reversedText: string | null,
  reversedTextEnd: string | null
];

const parameterCounts = new Map<string, number>();

/** The statement with the parameters it uses (`?1` to its highest number). */
function bind(sql: string, params: readonly SqlValue[]): SqlStatement {
  let count = parameterCounts.get(sql);

  if (count === undefined) {
    count = Math.max(0, ...[...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1])));
    parameterCounts.set(sql, count);
  }

  return { sql, params: params.slice(0, count) };
}

/** The smallest string greater than every string that begins with `text`. */
function rangeEnd(text: string): string {
  const characters = [...text];
  const last = characters.pop()!.codePointAt(0)!;
  // (Skipping the surrogates, which no string holds alone.)
  const next = last === 0xd7ff ? 0xe000 : last + 1;
  return characters.join("") + String.fromCodePoint(next);
}

/** The condition of a match on the search column (cf. `MatchKind`). */
function buildMatchSql(
  column: SearchColumn,
  kind: MatchKind,
  reversedKeys: boolean
): string {
  switch (kind) {
    case "equals":
      return `${column} = ?1`;
    case "prefix":
      return `(${column} >= ?1 AND ${column} < ?6)`;
    case "suffix":
      return reversedKeys
        ? `(${reversedColumn(column)} >= ?7 AND ${reversedColumn(column)} < ?8)`
        : `substr(${column}, -length(?1)) = ?1`;
    case "contains":
      return `instr(${column}, ?1) > 0`;
    case "pattern":
      return `${column} GLOB ?1`;
  }
}

const MORPHEUS_MATCH = "searchable IN (SELECT value FROM json_each(?3))";

function buildSelectedFields(
  fields: readonly string[],
  searchableField: string
): string {
  // `searchable` is always needed to resolve Morpheus lemmas, independently of the
  // field used for the user's direct query.
  return [
    ...new Set([...canonicalFields(fields), "searchable", searchableField])
  ].join(", ");
}

/**
 * The matches are returned in this order, which is also the front end's: exact
 * matches (the search key equals the query, without wildcards), then the lemmas found
 * by Morpheus, then the others, in the dictionary order (`orderedID`). The order must
 * hold *before* `LIMIT`, so that an exact match or a lemma is never cut off by a
 * few hundred matches that precede it in the dictionary (e.g. the compounds in
 * -λόγος for `λογος$`).
 *
 * An `ORDER BY` on these conditions would force SQLite to read and sort every match
 * (e.g. the whole table for `*α`) instead of stopping at `LIMIT`. The lookup is thus
 * split into two statements:
 *
 *   1. the "priority" rows (`buildPriorityLookupSql()`), found through the indexes
 *      and few, sorted by rank;
 *   2. the other direct matches (`buildOtherLookupSql()`), read in the dictionary
 *      order, then limited to what is left of `LIMIT` (cf. `getEntries()`).
 *
 * Every priority row is a match: a Morpheus lemma by definition, and an exact match
 * because `exactQuery` (no wildcards) always matches the query, which only adds
 * wildcards around it. Homonyms share their search keys: they always fall into the
 * same statement, so they stay together (and in the dictionary order).
 *
 * No `COUNT(*) OVER ()` here: the window function would force SQLite to read every
 * match (and every selected column) before applying `LIMIT`. The total is counted
 * separately (`buildCountStatements()`), and only when the limit has been reached.
 */
function buildPriorityLookupSql(
  fields: readonly string[],
  column: SearchColumn,
  kind: MatchKind,
  reversedKeys: boolean
): string {
  return `
    SELECT
      ${buildSelectedFields(fields, column)},
      ${buildMatchSql(column, kind, reversedKeys)} AS directMatch,
      ${MORPHEUS_MATCH} AS morpheusMatch
    FROM bailly
    WHERE ${column} = ?2
       OR ${MORPHEUS_MATCH}
    ORDER BY (${column} = ?2) DESC, morpheusMatch DESC, orderedID
    LIMIT ?4
  `;
}

/**
 * The direct matches that are not exact (cf. above). The Morpheus lemmas that are
 * also direct matches (e.g. πολύς for `πολυ`) are *not* excluded here, but by the
 * caller: their key, `searchable`, is not in the index of the search column, so
 * excluding them in SQL would force SQLite to read the row of every match (4× slower
 * for `α`), whereas it only reads those that make it into the `LIMIT` (`orderedID`,
 * the sort key, is the rowid, which the index holds).
 *
 * Two variants (`getOtherVariant()`):
 *
 *   - `plain`: every match is read and sorted by `orderedID` (`USE TEMP B-TREE`), the
 *     rows beyond `LIMIT` being discarded: 36 000 index entries for `α`;
 *   - `ordered`: the matches are read *in the order of the index* (the key, then
 *     `orderedID`), which is the dictionary order except for a few dozen rows
 *     (`bailly_unordered`, cf. `scripts/db_derive.ts`), excluded here and fetched by
 *     a second statement (`buildUnorderedLookupSql()`): SQLite stops at `LIMIT` (a
 *     few dozen rows read for `α`), and the caller merges the two sets in
 *     `orderedID` order. Only for the columns whose list is small, and not for a
 *     match on the reversed keys, whose order is unrelated to the dictionary's.
 */
type OtherVariant = "plain" | "ordered";

function getOtherVariant(
  column: SearchColumn,
  kind: MatchKind,
  derived: DerivedData
): OtherVariant {
  const onReversedKeys = kind === "suffix" && derived.reversedKeys;
  return kind !== "equals" && !onReversedKeys && derived.unordered.has(column)
    ? "ordered"
    : "plain";
}

function buildOtherLookupSql(
  fields: readonly string[],
  column: SearchColumn,
  kind: MatchKind,
  reversedKeys: boolean,
  variant: OtherVariant
): string {
  const match = buildMatchSql(column, kind, reversedKeys);

  return variant === "plain"
    ? `
    SELECT
      ${buildSelectedFields(fields, column)},
      1 AS directMatch,
      0 AS morpheusMatch
    FROM bailly
    WHERE ${match}
      AND ${column} IS NOT ?2
    ORDER BY orderedID
    LIMIT ?4
  `
    // `orderedID` for the merge with the unordered rows (removed from the output).
    : `
    SELECT
      ${buildSelectedFields(fields, column)},
      1 AS directMatch,
      0 AS morpheusMatch,
      orderedID
    FROM bailly
    WHERE ${match}
      AND ${column} IS NOT ?2
      AND orderedID NOT IN (SELECT value FROM json_each(?5))
    ORDER BY ${column}, orderedID
    LIMIT ?4
  `;
}

/** The matches among the rows out of index order (`ordered` variant). */
function buildUnorderedLookupSql(
  fields: readonly string[],
  column: SearchColumn,
  kind: MatchKind,
  reversedKeys: boolean
): string {
  return `
    SELECT
      ${buildSelectedFields(fields, column)},
      1 AS directMatch,
      0 AS morpheusMatch,
      orderedID
    FROM bailly
    WHERE orderedID IN (SELECT value FROM json_each(?5))
      AND ${buildMatchSql(column, kind, reversedKeys)}
      AND ${column} IS NOT ?2
  `;
}

/**
 * The total number of matches (direct and Morpheus): counted through the index
 * (every match read: 54 536 rows for `α`), or, for a prefix of at most
 * `PREFIX_COUNT_MAX_LENGTH` letters when the data has the counts, read from
 * `bailly_prefix_count`, plus the Morpheus lemmas that the prefix does not match.
 */
function buildCountSql(
  column: SearchColumn,
  kind: MatchKind,
  reversedKeys: boolean,
  precounted: boolean
): string {
  const match = buildMatchSql(column, kind, reversedKeys);

  return precounted
    ? `SELECT COUNT(*) AS count FROM bailly WHERE ${MORPHEUS_MATCH} AND NOT ${match}`
    : `SELECT COUNT(*) AS count FROM bailly WHERE ${match} OR ${MORPHEUS_MATCH}`;
}

const PREFIX_COUNT_SQL =
  "SELECT count FROM bailly_prefix_count WHERE column = ?1 AND prefix = ?2";

/**
 * Prepares every variant of the lookup statements that the data allows (search
 * column × kind of match × set of allowed fields × priority/other rows, plus the
 * count statements), so that no request pays for their compilation, even right
 * after a restart. Returns the number of statements.
 */
export function preloadLookupStatements(db: Dictionary, derived: DerivedData): number {
  const optionalFields = Settings.getSettings().queryAllowedFields
    .filter((field) => field !== "word");

  // 2^n field sets: beyond a dozen fields, let the statements be prepared lazily.
  if (optionalFields.length > 12) return 0;

  const fieldSets = Array.from(
    { length: 2 ** optionalFields.length },
    (_, mask) => optionalFields.filter((_, i) => mask & (1 << i))
  );

  const statements = new Set<string>();
  if (derived.prefixCounts) statements.add(PREFIX_COUNT_SQL);

  for (const column of SEARCH_COLUMNS) {
    for (const kind of MATCH_KINDS) {
      const reversedKeys = derived.reversedKeys;
      const variant = getOtherVariant(column, kind, derived);

      statements.add(buildCountSql(column, kind, reversedKeys, false));
      if (kind === "prefix" && derived.prefixCounts) {
        statements.add(buildCountSql(column, kind, reversedKeys, true));
      }

      for (const fields of fieldSets) {
        statements.add(buildPriorityLookupSql(fields, column, kind, reversedKeys));
        statements.add(buildOtherLookupSql(fields, column, kind, reversedKeys, variant));
        if (variant === "ordered") {
          statements.add(buildUnorderedLookupSql(fields, column, kind, reversedKeys));
        }
      }
    }
  }

  for (const sql of statements) db.prepare(sql);
  return statements.size;
}

function formatMorpheusLemmaForSearch(lemma: string): string {
  return formatSearchableValue(lemma, true, true);
}

const TIS_SEARCHABLE = {
  grave: formatMorpheusLemmaForSearch("τὶς"),
  acute: formatMorpheusLemmaForSearch("τίς"),
  unaccented: formatMorpheusLemmaForSearch("τις")
} as const;

function getMorpheusLemmaSearchKey({ lemma, stem }: MorphologyKey): string {
  const lemmaKey = formatMorpheusLemmaForSearch(lemma);
  const stemKey = formatMorpheusLemmaForSearch(stem);

  // τὶς is Bailly's only lexical grave exception. The explicit surface form
  // wins over Morpheus' grave→acute normalization.
  if (stemKey === TIS_SEARCHABLE.grave) return TIS_SEARCHABLE.grave;
  if (stemKey === TIS_SEARCHABLE.acute) return TIS_SEARCHABLE.acute;

  // Morpheus uses an unaccented lemma for the indefinite pronoun in forms
  // such as τι, τινος and τινι; Bailly records that lemma under τὶς.
  if (lemmaKey === TIS_SEARCHABLE.unaccented) return TIS_SEARCHABLE.grave;

  return lemmaKey;
}

function getMorpheusAnalysesSearchableKeys(
  analyses: MorpheusResponse
): string[] {
  return [
    ...new Set(
      Object.keys(analyses)
        .map(parseMorphologyKey)
        .filter((key): key is MorphologyKey => key !== undefined)
        .map(getMorpheusLemmaSearchKey)
    )
  ];
}

async function getMorpheusAnalyses(
  morpheus: Morpheus,
  greekStr: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): Promise<MorpheusResponse> {
  // @TODO Add a jokers interpreter in `morpheus.lookup()` to support them.
  if (/[*?]/.test(greekStr)) return {};

  return await morpheus.lookup(greekStr, {
    caseSensitive,
    diacriticSensitive
  });
}

function attachMorphology(
  partialResponse: LookupResponse,
  morpheusMorphology: MorpheusResponse<Morphology>
): LookupResponse {
  const entrySearchables = new Set(
    partialResponse.data.entries
      .map((entry) => entry.searchable)
      .filter((value): value is string => Boolean(value))
  );

  const bySearchable: Record<string, Record<string, Morphology[]>> = {};
  const orphans: Record<string, Morphology[]> = {};

  for (
    const [compoundKey, analyses] of Object.entries(morpheusMorphology) as [
      string,
      Morphology[]
    ][]
  ) {
    const parsed = parseMorphologyKey(compoundKey);

    if (!parsed) {
      orphans[compoundKey] = analyses;
      continue;
    }

    const searchable = getMorpheusLemmaSearchKey(parsed);

    if (!entrySearchables.has(searchable)) {
      orphans[compoundKey] = analyses;
      continue;
    }

    bySearchable[searchable] = {
      ...bySearchable[searchable],
      [parsed.stem]: analyses
    };
  }

  const response: LookupResponse = {
    data: {
      ...partialResponse.data,
      entries: partialResponse.data.entries.map((entry) => {
        const searchable = entry.searchable;

        return {
          ...entry,
          ...(searchable && bySearchable[searchable] && {
            morphology: bySearchable[searchable]
          })
        };
      })
    }
  };

  if (Settings.getSettings().isDevEnv) {
    response.data.orphanMorphology = orphans;
  }

  return response;
}

function emptyResponse(): ApiLookupResponse<never> {
  return {
    data: {
      version: Settings.getSettings().dbVersion,
      count: 0,
      countAll: 0,
      entries: []
    }
  };
}

export function setUniqueEntries(
  inputEntries: MatchedDatabaseEntry[],
  _params?: { caseSensitive?: boolean }
): LookupEntry[] {
  const uniqueEntries: LookupEntry[] = [];

  for (
    const [word, entries] of Object.entries(
      Object.groupBy(inputEntries, ({ word }) => word)
    )
  ) {
    if (!entries) continue;

    if (entries.length > 1) {
      const entry: LookupEntry = {
        ...entries[0]
      };

      // @ts-ignore replace each key by an empty string.
      Object.keys(entries[0]).forEach((prop) => (entry[prop] = ""));

      entry.word = word;
      entry.uri = entries[0].uri?.replace(/#\d$/, "");
      entry.children = entries; // children may be truncated due to `limit` param

      // Keep internal lookup fields until morphology and exactness have been resolved.
      entry.searchable = entries[0].searchable ?? "";
      entry.searchableCaseInsensitive = entries[0].searchableCaseInsensitive ?? "";
      entry.searchableAtonic = entries[0].searchableAtonic ?? "";
      entry.searchableAtonicCaseInsensitive =
        entries[0].searchableAtonicCaseInsensitive ?? "";

      // Keep match provenance until `isExact` and `isMorpheus` have been resolved.
      entry.directMatch = Number(
        entries.some((entry) => Boolean(entry.directMatch))
      );
      entry.morpheusMatch = Number(
        entries.some((entry) => Boolean(entry.morpheusMatch))
      );

      uniqueEntries.push(entry);
      continue;
    }

    uniqueEntries.push(entries[0]);
  }

  return uniqueEntries;
}

/**
 * @fixme is this too restrictive? e.g. regarding strings beginning with a dash.
 * A. Empty string.
 * B. One char: only allow greek letters (digamma included).
 * C. (1) Allow a maximum of 50 characters.
 *    (2) Only allow greek letters (digamma included), spaces, elision marks (formally:
 *        'right single quotation mark'), tirets and metacharacters (`^`, `$`, `?`, `*` `"`);
 *    (3) Allow a maximum of three identical characters in a row.
 */
function validateQueryStr(greekStr: string): boolean {
  // Not `removeDiacritics(…, "greek")` from greek-conversion: since 1.0, it parses
  // `?` as a Greek question mark (U+037E), which invalidated every `?` wildcard.
  greekStr = toSearchKey(greekStr);

  if (!greekStr) return false;
  if (greekStr.length === 1) return /[^α-ωϝ]/i.test(greekStr) === false;

  return (
    greekStr.length < 50 &&
    /[^α-ωϝ\s’\-^$?*"]/i.test(greekStr) === false &&
    /(.)\1{3,}/.test(greekStr) === false
  );
}

export async function getEntries<K extends keyof QueryableFields>(
  db: Dictionary,
  morpheus: Morpheus,
  {
    q,
    inputMode,
    fields,
    morphology,
    caseSensitive,
    diacriticSensitive,
    limit,
    skipMorpheus
  }: ApiLookupParams<K>
): Promise<
  ApiLookupResponse<K> | ApiLookupResponse<never>
> {
  const settings = Settings.getSettings();

  if (inputMode === "beta-code" || inputMode === "transliteration") {
    q = queryToGreek(q, inputMode);
  }

  const {
    searchStr,
    surfaceForm,
    lookupMode
  } = formatQueryStr(q, caseSensitive, diacriticSensitive);

  if (!validateQueryStr(searchStr)) {
    if (settings.isDevEnv) {
      console.log(
        `%cInvalid input '${searchStr}' ` +
          "(will return an empty response).",
        "color:orange"
      );
    }
    return emptyResponse();
  }

  const wordRequested = (fields as string[]).includes("word");
  const searchableField = formatSearchableField(
    caseSensitive,
    diacriticSensitive
  );

  const morpheusAnalyses = skipMorpheus ? {} : await getMorpheusAnalyses(
    morpheus,
    surfaceForm,
    caseSensitive,
    diacriticSensitive
  );

  const morpheusSearchableKeys = getMorpheusAnalysesSearchableKeys(
    morpheusAnalyses
  );

  const query = (() => {
    switch (lookupMode) {
      case LookupMode.exact:
        return searchStr;
      case LookupMode.startsWith:
        return /^[^*?]+/.test(searchStr) ? `*${searchStr}` : searchStr;
      case LookupMode.endsWith:
      default:
        return /[^*?]+$/.test(searchStr) ? `${searchStr}*` : searchStr;
    }
  })();

  const kind = getMatchKind(
    query,
    lookupMode === LookupMode.exact && !/[*?]/.test(searchStr)
  );

  // The text of the match, without its outer `*`; a pattern as is.
  const text = kind === "pattern" ? query : query.replace(/^\*|\*$/g, "");

  if (
    kind === "pattern" && new TextEncoder().encode(text).length > PATTERN_MAX_BYTES
  ) {
    if (settings.isDevEnv) {
      console.log(`Pattern too long '${text}' (will return an empty response).`);
    }
    return emptyResponse();
  }

  // The query without its leading and trailing `*`, if it has no other wildcard: the
  // search key of an exact match. `null` matches nothing (no exact match possible).
  const exactSearchStr = searchStr.replace(/^\*+|\*+$/g, "");
  const exactQuery = /[*?]/.test(exactSearchStr) ? null : exactSearchStr;

  const limitValue = limit && limit <= settings.queryMaxRows
    ? limit
    : settings.queryMaxRows === Infinity
    ? -1
    : settings.queryMaxRows;

  const derived = await getDerivedData(db);
  const reversedKeys = derived.reversedKeys;
  const variant = getOtherVariant(searchableField, kind, derived);
  const reversedText = kind === "suffix" ? reverseKey(text) : null;

  const params: LookupParams = [
    text,
    exactQuery,
    JSON.stringify(morpheusSearchableKeys),
    limitValue,
    variant === "ordered"
      ? JSON.stringify(derived.unordered.get(searchableField))
      : null,
    kind === "prefix" ? rangeEnd(text) : null,
    reversedText,
    reversedText && rangeEnd(reversedText)
  ];

  // The SQL text only varies within a closed set (search column, kind of match, set
  // of selected fields, variant): the statements are prepared at startup and then
  // reused. Exact matches and Morpheus lemmas first, then the other matches within
  // what is left of the limit (cf. `buildPriorityLookupSql()`). Every statement goes
  // in one batch (one round trip on D1): the other rows are limited to `limit` too,
  // and trimmed below to what the priority rows leave.
  const [priorityData, ...otherSets] = await db.batch<MatchedDatabaseEntry>([
    bind(buildPriorityLookupSql(fields, searchableField, kind, reversedKeys), params),
    bind(
      buildOtherLookupSql(fields, searchableField, kind, reversedKeys, variant),
      params
    ),
    ...(variant === "ordered"
      ? [
        bind(
          buildUnorderedLookupSql(fields, searchableField, kind, reversedKeys),
          params
        )
      ]
      : [])
  ]) as [MatchedDatabaseEntry[], ...MatchedDatabaseEntry[][]];

  const otherLimit = limitValue === -1 ? -1 : limitValue - priorityData.length;

  // The Morpheus lemmas that are also direct matches come back here and are removed
  // (cf. `buildOtherLookupSql()`). They all are among the priority rows (unless those
  // already fill the limit, in which case none is kept): at most
  // `priorityData.length` rows are removed, so `limit` rows are enough. The `ordered`
  // variant gives two sets (the rows in index order, the rows out of it), merged in
  // the dictionary order: the first `limit` rows of the merge are all there.
  const morpheusKeys = new Set(morpheusSearchableKeys);

  const otherRows = otherSets.length > 1
    ? otherSets.flat().sort((a, b) => a.orderedID! - b.orderedID!)
    : otherSets[0]!;

  const otherData = otherLimit === 0 ? [] : otherRows
    .filter((entry) => !morpheusKeys.has(entry.searchable!))
    .slice(0, otherLimit === -1 ? undefined : otherLimit);

  const data = [...priorityData, ...otherData];

  // A prefix of a few letters: its count is precomputed (cf. `buildCountSql()`).
  const precounted = kind === "prefix" && derived.prefixCounts &&
    [...text].length <= PREFIX_COUNT_MAX_LENGTH;

  const countAll = limitValue === -1 || data.length < limitValue
    ? data.length
    : (await db.batch<{ count: number | null }>([
      ...(precounted
        ? [bind(PREFIX_COUNT_SQL, [searchableField, text])]
        : []),
      bind(buildCountSql(searchableField, kind, reversedKeys, precounted), params)
    ])).reduce((total, rows) => total + (rows[0]?.count ?? 0), 0);

  let internalResponse: LookupResponse = {
    data: {
      version: settings.dbVersion,
      count: data.length,
      countAll,
      entries: setUniqueEntries(data)
    }
  };

  if (morphology) {
    const morpheusMorphology: MorpheusResponse<Morphology> = Object.fromEntries(
      Object.entries(morpheusAnalyses).map(([key, analyses]) => [
        key,
        analyses.map(getMorphology)
      ])
    );

    internalResponse = attachMorphology(
      internalResponse,
      morpheusMorphology
    );
  }

  const response: ApiLookupResponse<keyof QueryableFields> = {
    data: {
      ...internalResponse.data,
      entries: internalResponse.data.entries.map((entry) => {
        const searchableFieldValue = entry[
          searchableField as keyof typeof entry
        ];

        const isExact = lookupMode === LookupMode.exact ||
          (exactQuery !== null && exactQuery === searchableFieldValue);

        const isMorpheus = Boolean(entry.morpheusMatch) &&
          !Boolean(entry.directMatch);

        const removeExtraFields = (entry: Partial<LookupEntry>): void => {
          if (!wordRequested) delete entry.word;
          delete entry.orderedID;
          delete entry.searchable;
          delete entry.searchableCaseInsensitive;
          delete entry.searchableAtonic;
          delete entry.searchableAtonicCaseInsensitive;
          delete entry.directMatch;
          delete entry.morpheusMatch;
        };

        removeExtraFields(entry);
        entry.children?.forEach(removeExtraFields);

        return {
          ...entry,
          // Public contract (relied on by the front end, e.g. for highlighting and
          // sorting): an entry found through Morpheus is an exact match of the form.
          isExact: isExact || isMorpheus,
          isMorpheus
        };
        // The internal fields have been removed by `removeExtraFields()`.
      }) as ApiLookupResponse<keyof QueryableFields>["data"]["entries"]
    }
  };

  return response;
}
