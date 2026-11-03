import { convert } from "@humanities/greek-conversion";
import type { Dictionary, SqlValue } from "../db/dictionary.ts";
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
import { toBaillySearchKey, toSearchKey } from "../searchKey.ts";
import { Settings } from "../Settings.ts";

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
): string {
  return `searchable${diacriticSensitive ? "" : "Atonic"}${
    caseSensitive ? "" : "CaseInsensitive"
  }`;
}

type ComparisonOperator = "=" | "GLOB";

const COMPARISON_OPERATORS: readonly ComparisonOperator[] = ["=", "GLOB"];

const SEARCHABLE_FIELDS: readonly string[] = [false, true].flatMap((caseSensitive) =>
  [false, true].map((diacriticSensitive) =>
    formatSearchableField(caseSensitive, diacriticSensitive)
  )
);

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
 * The three lookup statements take the same positional parameters, in this order
 * (cf. `LookupParams`), whether they use them all or not: the SQL text of each one
 * is thus fixed for a given search column, operator and set of fields.
 *
 *   ?1 `query`: the pattern (or the exact key) matched against the search column;
 *   ?2 `exactQuery`: the search key of an exact match (`null`: none possible);
 *   ?3 `morpheusSearchableKeys`: JSON array of the search keys of the lemmas;
 *   ?4 `limit`.
 */
type LookupParams = readonly [
  query: string,
  exactQuery: string | null,
  morpheusSearchableKeys: string,
  limit: number
];

const MORPHEUS_MATCH = "searchable IN (SELECT value FROM json_each(?3))";

function buildWhereClause(
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `
    WHERE ${searchableField} ${operator} ?1
       OR ${MORPHEUS_MATCH}
  `;
}

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
 * because `exactQuery` (no wildcards) always matches the `query` pattern, which only
 * adds wildcards around it. Homonyms share their search keys: they always fall into
 * the same statement, so they stay together (and in the dictionary order).
 *
 * No `COUNT(*) OVER ()` here: the window function would force SQLite to read every
 * match (and every selected column) before applying `LIMIT`. The total is counted
 * separately (`buildCountSql()`), and only when the limit has been reached.
 */
function buildPriorityLookupSql(
  fields: readonly string[],
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `
    SELECT
      ${buildSelectedFields(fields, searchableField)},
      ${searchableField} ${operator} ?1 AS directMatch,
      ${MORPHEUS_MATCH} AS morpheusMatch
    FROM bailly
    WHERE ${searchableField} = ?2
       OR ${MORPHEUS_MATCH}
    ORDER BY (${searchableField} = ?2) DESC, morpheusMatch DESC, orderedID
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
 */
function buildOtherLookupSql(
  fields: readonly string[],
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `
    SELECT
      ${buildSelectedFields(fields, searchableField)},
      1 AS directMatch,
      0 AS morpheusMatch
    FROM bailly
    WHERE ${searchableField} ${operator} ?1
      AND ${searchableField} IS NOT ?2
    ORDER BY orderedID
    LIMIT ?4
  `;
}

function buildCountSql(
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `SELECT COUNT(*) AS count FROM bailly ${
    buildWhereClause(searchableField, operator)
  }`;
}

/**
 * Prepares every variant of the lookup statements (search column × operator ×
 * set of allowed fields × priority/other rows, plus the count statement per search
 * column × operator), so that no request pays for their compilation, even
 * right after a restart. Returns the number of prepared statements.
 */
export function preloadLookupStatements(db: Dictionary): number {
  const optionalFields = Settings.getSettings().queryAllowedFields
    .filter((field) => field !== "word");

  // 2^n field sets: beyond a dozen fields, let the statements be prepared lazily.
  if (optionalFields.length > 12) return 0;

  const fieldSets = Array.from(
    { length: 2 ** optionalFields.length },
    (_, mask) => optionalFields.filter((_, i) => mask & (1 << i))
  );

  let count = 0;

  for (const searchableField of SEARCHABLE_FIELDS) {
    for (const operator of COMPARISON_OPERATORS) {
      db.prepare(buildCountSql(searchableField, operator));
      count++;

      for (const fields of fieldSets) {
        for (const buildSql of [buildPriorityLookupSql, buildOtherLookupSql]) {
          db.prepare(buildSql(fields, searchableField, operator));
          count++;
        }
      }
    }
  }

  return count;
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

  if (["beta-code", "transliteration"].includes(inputMode)) {
    q = convert(q, inputMode, "greek");
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

  const comparisonOperator: ComparisonOperator =
    lookupMode === LookupMode.exact && !/[*?]/.test(searchStr) ? "=" : "GLOB";

  const prioritySql = buildPriorityLookupSql(
    fields,
    searchableField,
    comparisonOperator
  );
  const otherSql = buildOtherLookupSql(fields, searchableField, comparisonOperator);
  const countSql = buildCountSql(searchableField, comparisonOperator);

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

  // The query without its leading and trailing `*`, if it has no other wildcard: the
  // search key of an exact match. `null` matches nothing (no exact match possible).
  const exactSearchStr = searchStr.replace(/^\*+|\*+$/g, "");
  const exactQuery = /[*?]/.test(exactSearchStr) ? null : exactSearchStr;

  const limitValue = limit && limit <= settings.queryMaxRows
    ? limit
    : settings.queryMaxRows === Infinity
    ? -1
    : settings.queryMaxRows;

  const params: LookupParams = [
    query,
    exactQuery,
    JSON.stringify(morpheusSearchableKeys),
    limitValue
  ];

  // The SQL text only varies within a closed set (search column, operator, set of
  // selected fields): the statements are prepared at startup and then reused.
  // Exact matches and Morpheus lemmas first, then the other matches within what is
  // left of the limit (cf. `buildPriorityLookupSql()`). Both statements go in one
  // batch (one round trip on D1): the other rows are limited to `limit` too, and
  // trimmed below to what the priority rows leave.
  const [priorityData, otherRows] = await db.batch<MatchedDatabaseEntry>([
    { sql: prioritySql, params: params as readonly SqlValue[] },
    { sql: otherSql, params: params as readonly SqlValue[] }
  ]) as [MatchedDatabaseEntry[], MatchedDatabaseEntry[]];

  const otherLimit = limitValue === -1 ? -1 : limitValue - priorityData.length;

  // The Morpheus lemmas that are also direct matches come back here and are removed
  // (cf. `buildOtherLookupSql()`). They all are among the priority rows (unless those
  // already fill the limit, in which case none is kept): at most
  // `priorityData.length` rows are removed, so `limit` rows are enough.
  const morpheusKeys = new Set(morpheusSearchableKeys);

  const otherData = otherLimit === 0 ? [] : otherRows
    .filter((entry) => !morpheusKeys.has(entry.searchable!))
    .slice(0, otherLimit === -1 ? undefined : otherLimit);

  const data = [...priorityData, ...otherData];

  const countAll = limitValue === -1 || data.length < limitValue
    ? data.length
    // (D1 wants exactly as many values as the highest parameter number: 3 here.)
    : (await db.get<{ count: number }>(countSql, params.slice(0, 3)))
      ?.count ?? data.length;

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
