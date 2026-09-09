import {
  convert,
  foldGreekVariants,
  removeDiacritics
} from "@humanities/greek-conversion";
import { Database } from "../Database.ts";
import type {
  ApiLookupParams,
  ApiLookupResponse,
  DatabaseEntry,
  Entry,
  Optional,
  PartialExcept,
  QueryableFields
} from "../definitions.ts";
import { SpecialChar } from "../enums.ts";
import { graveToAcute } from "../helpers.ts";
import { Morpheus, type MorpheusAnalysis, type MorpheusResponse } from "../Morpheus.ts";
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

type MorphologyKey = {
  lemma: string;
  stem: string;
};

type Morphology = Pick<
  MorpheusResponse,
  | "partOfSpeech"
  | "dialects"
  | "geographicRegions"
  | "person"
  | "grammaticalNumber"
  | "genders"
  | "grammaticalCases"
  | "tense"
  | "mood"
  | "voices"
  | "degree"
  | "preverb"
  | "augment"
  | "morphFlags"
>;

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

const TIS_GRAVE = "τὶς";
const TIS_GRAVE_NFD = TIS_GRAVE.normalize("NFD");

function parseMorphologyKey(key: string): MorphologyKey | undefined {
  const separatorIndex = key.indexOf("|");
  if (separatorIndex === -1) return undefined;

  return {
    lemma: key.slice(0, separatorIndex),
    stem: key.slice(separatorIndex + 1)
  };
}

function normalizeBaillyGraves(value: string): string {
  return value.normalize("NFD").toLowerCase() === TIS_GRAVE_NFD
    ? value.normalize("NFC")
    : graveToAcute(value);
}

// @fixme this would make sense if an option 'permissive: boolean' is added to the API.
function sanitizeGreek(word: string): string {
  return word
    // @fixme NFC/NFKC normalization breaks matches with the data converter.
    //.normalize("NFD")
    //.replace(/[\u0304\u0306]/g, "") // macron, breve
    //.normalize("NFC")
    .replace(/[·•]/g, "");
}

function formatSearchableValue(
  value: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): string {
  let formatted = value.trim();

  if (diacriticSensitive) {
    formatted = normalizeBaillyGraves(formatted);
  }

  formatted = foldGreekVariants(formatted);

  if (!caseSensitive) {
    formatted = formatted.toLowerCase();
  }

  if (!diacriticSensitive) {
    formatted = removeDiacritics(formatted, "greek");
  }

  // The searchable* columns don't contain Bailly's extended contract-verb
  // suffix "-ῶ", contrary to the `word` column.
  formatted = diacriticSensitive
    ? formatted.replace(/(?<=ω)-ῶ$/, "")
    : formatted.replace(/(?<=ω)-[ῶω]$/, "");

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

function attachMorphology<K extends keyof QueryableFields>(
  partialResponse: ApiLookupResponse<K>,
  morpheusMorphology: MorphologyResponse
): ApiLookupResponse<K> {
  const entrySearchables = new Set(
    partialResponse.data.entries
      .map((entry) => (entry as Partial<DatabaseEntry>).searchable)
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

  const response = {
    data: {
      ...partialResponse.data,
      entries: partialResponse.data.entries.map((entry) => {
        const searchable = (entry as Partial<DatabaseEntry>).searchable;

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
  inputEntries: PartialExcept<DatabaseEntry, "word">[],
  _params?: { caseSensitive?: boolean }
): (
  & PartialExcept<Entry, "word" | "children">
  & Optional<
    DatabaseEntry,
    | "searchable"
    | "searchableCaseInsensitive"
    | "searchableAtonic"
    | "searchableAtonicCaseInsensitive"
  >
)[] {
  const uniqueEntries: PartialExcept<Entry, "word">[] = [];

  for (
    const [word, entries] of Object.entries(
      Object.groupBy(inputEntries, ({ word }) => word)
    )
  ) {
    if (!entries) continue;

    if (entries.length > 1) {
      const entry:
        & PartialExcept<Entry<"word">, "word" | "children">
        & Optional<
          DatabaseEntry,
          | "countAll"
          | "searchable"
          | "searchableCaseInsensitive"
          | "searchableAtonic"
          | "searchableAtonicCaseInsensitive"
        > = {
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
  greekStr = removeDiacritics(greekStr, "greek");

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
  const db = await Database.getConnection();
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
        `%cInvalid input '${removeDiacritics(searchStr, "greek")}' ` +
          "(will return an empty response).",
        "color:orange"
      );
    }
    return emptyResponse();
  }

  const wordRequested = fields.includes("word");
  const queryFields = wordRequested ? fields : ["word", ...fields];
  const searchableField = formatSearchableField(
    caseSensitive,
    diacriticSensitive
  );

  // `searchable` is always needed to resolve Morpheus lemmas, independently
  // from the field used for the user's direct query.
  const selectedFields = [
    ...new Set<string>([
      ...queryFields,
      "searchable",
      searchableField
    ])
  ].join(", ");

  const morpheusAnalyses = skipMorpheus ? {} : await getMorpheusAnalyses(
    surfaceForm,
    caseSensitive,
    diacriticSensitive
  );

  const morpheusSearchableKeys = getMorpheusAnalysesSearchableKeys(
    morpheusAnalyses
  );

  const comparisonOperator = lookupMode === LookupMode.exact && !/[*?]/.test(searchStr)
    ? "="
    : "GLOB";

  const sql = `
    SELECT ${selectedFields}, COUNT(*) OVER () AS countAll
    FROM bailly
    WHERE ${searchableField} ${comparisonOperator} $query
          OR searchable IN (SELECT value FROM json_each($morpheusSearchableKeys))
    ORDER BY orderedID
    LIMIT $limit
  `;

  const params: { [key: string]: any } = {
    $query: (() => {
      switch (lookupMode) {
        case LookupMode.exact:
          return searchStr;
        case LookupMode.startsWith:
          return /^[^*?]+/.test(searchStr) ? `*${searchStr}` : searchStr;
        case LookupMode.endsWith:
        default:
          return /[^*?]+$/.test(searchStr) ? `${searchStr}*` : searchStr;
      }
    })(),
    $morpheusSearchableKeys: JSON.stringify(morpheusSearchableKeys),
    $limit: limit && limit <= settings.queryMaxRows
      ? limit
      : settings.queryMaxRows === Infinity
      ? -1
      : settings.queryMaxRows
  };

  const data = <PartialExcept<DatabaseEntry, "word">[]> (
    db.prepare(sql).all(params)
  );

  let internalResponse: ApiLookupResponse<keyof QueryableFields> = {
    data: {
      version: settings.dbVersion,
      count: data.length,
      countAll: data[0]?.countAll ?? 0,
      entries: uniqueEntries.map((item) => {
        const searchableFieldValue =
          item[formatSearchableField(caseSensitive, diacriticSensitive)];
      entries: setUniqueEntries(data)
    }
  };

  if (morphology) {
    const morpheusMorphology: MorphologyResponse = Object.fromEntries(
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
      entries: internalResponse.data.entries.map((item) => {
        const searchableFieldValue = (item as Partial<DatabaseEntry>)[
          searchableField as keyof DatabaseEntry
        ] ?? "";
        const normalizedSearchStr = caseSensitive ? searchStr : searchStr.toLowerCase();

        const isExact = normalizedSearchStr === searchableFieldValue;
        const isMorpheus = Boolean(
          morpheusSearchableKeys.length &&
            (
              (lookupMode === LookupMode.exact &&
                searchableFieldValue.length !== searchStr.length) ||
              (/^[α-ω-]|[α-ω’-]$/i.test(normalizedSearchStr) &&
                !searchableFieldValue.startsWith(normalizedSearchStr))
            )
        );

        const removeExtraFields = (
          entry:
            & Partial<Entry>
            & Optional<
              DatabaseEntry,
              | "countAll"
              | "searchable"
              | "searchableCaseInsensitive"
              | "searchableAtonic"
              | "searchableAtonicCaseInsensitive"
            >
        ): void => {
          delete entry.countAll;
          delete entry.searchable;
          delete entry.searchableCaseInsensitive;
          delete entry.searchableAtonic;
          delete entry.searchableAtonicCaseInsensitive;
          if (!wordRequested) delete entry.word;
        };

        removeExtraFields(item);
        item.children?.forEach(removeExtraFields);

        return {
          ...item,
          isMorpheus,
          isExact: isMorpheus || isExact
        };
      })
    }
  };

  return response;
}
