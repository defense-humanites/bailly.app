import { toBaillySearchKey, toSearchKey } from "@humanities/bailly-search-key";
import { convert } from "@humanities/greek-conversion";
import { Database } from "../Database.ts";
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
  Morpheus,
  type MorpheusAnalysis,
  type MorpheusResponse,
  type Morphology
} from "../Morpheus.ts";
import { Settings } from "../Settings.ts";

enum LookupMode {
  exact,
  startsWith,
  endsWith
}

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
  morphFlags
}: MorpheusAnalysis): Morphology {
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
    morphFlags
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

function buildWhereClause(
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `
    WHERE ${searchableField} ${operator} $query
       OR searchable IN (SELECT value FROM json_each($morpheusSearchableKeys))
  `;
}

/**
 * No `COUNT(*) OVER ()` here: the window function would force SQLite to read every
 * match (and every selected column) before applying `LIMIT`. The total is counted
 * separately (`buildCountSql()`), and only when the limit has been reached.
 */
function buildLookupSql(
  fields: readonly string[],
  searchableField: string,
  operator: ComparisonOperator
): string {
  // `searchable` is always needed to resolve Morpheus lemmas, independently of the
  // field used for the user's direct query.
  const selectedFields = [
    ...new Set([...canonicalFields(fields), "searchable", searchableField])
  ].join(", ");

  return `
    SELECT
      ${selectedFields},
      ${searchableField} ${operator} $query AS directMatch,
      searchable IN (SELECT value FROM json_each($morpheusSearchableKeys))
        AS morpheusMatch
    FROM bailly
    ${buildWhereClause(searchableField, operator)}
    ORDER BY orderedID
    LIMIT $limit
  `;
}

function buildCountSql(
  searchableField: string,
  operator: ComparisonOperator
): string {
  return `SELECT COUNT(*) FROM bailly ${
    buildWhereClause(searchableField, operator)
  }`;
}

/**
 * Prepares every variant of the lookup statements (search column × operator ×
 * set of allowed fields), so that no request pays for their compilation, even
 * right after a restart. Returns the number of prepared statements.
 */
export async function preloadLookupStatements(): Promise<number> {
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
      await Database.prepare(buildCountSql(searchableField, operator));
      count++;

      for (const fields of fieldSets) {
        await Database.prepare(buildLookupSql(fields, searchableField, operator));
        count++;
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
  greekStr: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): Promise<MorpheusResponse> {
  const morpheus = await Morpheus.getMorpheus();

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

export async function getEntries<K extends keyof QueryableFields>({
  q,
  inputMode,
  fields,
  morphology,
  caseSensitive,
  diacriticSensitive,
  limit,
  skipMorpheus
}: ApiLookupParams<K>): Promise<
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
    surfaceForm,
    caseSensitive,
    diacriticSensitive
  );

  const morpheusSearchableKeys = getMorpheusAnalysesSearchableKeys(
    morpheusAnalyses
  );

  const comparisonOperator: ComparisonOperator =
    lookupMode === LookupMode.exact && !/[*?]/.test(searchStr) ? "=" : "GLOB";

  const sql = buildLookupSql(fields, searchableField, comparisonOperator);
  const countSql = buildCountSql(searchableField, comparisonOperator);

  const $query = (() => {
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

  const $morpheusSearchableKeys = JSON.stringify(morpheusSearchableKeys);

  const $limit = limit && limit <= settings.queryMaxRows
    ? limit
    : settings.queryMaxRows === Infinity
    ? -1
    : settings.queryMaxRows;

  // The SQL text only varies within a closed set (search column, operator, set of
  // selected fields): the statements are prepared at startup and then reused.
  const data = <MatchedDatabaseEntry[]> (
    (await Database.prepare(sql)).all({
      $query,
      $morpheusSearchableKeys,
      $limit
    })
  );

  const countAll = $limit === -1 || data.length < $limit
    ? data.length
    : (await Database.prepare(countSql)).value<[number]>({
      $query,
      $morpheusSearchableKeys
    })?.[0] ?? data.length;

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

        const exactSearchStr = searchStr.replace(/^\*+|\*+$/g, "");

        const isExact = lookupMode === LookupMode.exact ||
          (
            !/[*?]/.test(exactSearchStr) &&
            exactSearchStr === searchableFieldValue
          );

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
