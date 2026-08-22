import {
  KeyType,
  removeDiacritics,
  removeGreekVariants,
  toBetaCode,
  toGreek
} from "greek-conversion";
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
import { Morpheus, type MorpheusResponse } from "../Morpheus.ts";
import { Settings } from "../Settings.ts";
import type { MorpheusAnalysis, Morphology } from "../MorpheusParser.ts";

enum LookupMode {
  exact,
  startsWith,
  endsWith
}

type QueryStringFormat = {
  searchStr: string;
  lookupMode: LookupMode;
};

type MorphologyKey = {
  lemma: string;
  stem: string;
};

function parseMorphologyKey(key: string): MorphologyKey | undefined {
  const separatorIndex = key.indexOf("|");
  if (separatorIndex === -1) return undefined;

  return {
    lemma: key.slice(0, separatorIndex),
    stem: key.slice(separatorIndex + 1)
  };
}

function attachMorphology<K extends keyof QueryableFields>(
  partialResponse: ApiLookupResponse<K>,
  orphanMorphology: MorpheusResponse<Morphology>
): ApiLookupResponse<K> {
  const entryWords = new Set(partialResponse.data.entries.map(({ word }) => word));

  const { byLemma, orphans } = Object.entries(orphanMorphology)
    .reduce(
      (acc, [compoundKey, analyses]) => {
        const parsed = parseMorphologyKey(compoundKey);

        if (!parsed || !entryWords.has(parsed.lemma)) {
          acc.orphans[compoundKey] = analyses;
          return acc;
        }

        acc.byLemma[parsed.lemma] = {
          ...acc.byLemma[parsed.lemma],
          [parsed.stem]: analyses
        };

        return acc;
      },
      {
        byLemma: {} as Record<string, Record<string, Morphology[]>>,
        orphans: {} as Record<string, Morphology[]>
      }
    );

  let response = {
    data: {
      ...partialResponse.data,
      entries: partialResponse.data.entries.map((entry) => ({
        ...entry,
        ...(byLemma[entry.word] && {
          morphology: byLemma[entry.word]
        })
      }))
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

// @fixme this would make sense if an option 'permissive: boolean' is added to the API.
function sanitizeGreek(word: string): string {
  return word
    // @fixme NFC/NFKC normalization breaks matches with the data converter.
    //.normalize("NFD")
    //.replace(/[\u0304\u0306]/g, "") // macron, breve
    //.normalize("NFC")
    .replace(/[·•]/g, "");
}

export function setUniqueEntries(
  inputEntries: PartialExcept<DatabaseEntry, "word">[],
  params?: {
    caseSensitive?: boolean;
  }
): (
  & PartialExcept<Entry, "word" | "children">
  & Optional<
    DatabaseEntry,
    "searchableAtonic" | "searchableAtonicCaseInsensitive"
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
      // Create a common entry and place the actual entries as children.
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

      if (params && Object.keys(params).length) {
        if ("caseSensitive" in params) {
          if (params.caseSensitive) {
            entry.searchableAtonic = entries[0].searchableAtonic ?? "";
          } else {
            entry.searchableAtonicCaseInsensitive =
              entries[0].searchableAtonicCaseInsensitive ?? "";
          }
        }
      }

      uniqueEntries.push(entry);
      continue;
    }

    uniqueEntries.push(entries[0]);
  }

  return uniqueEntries;
}

function formatQueryStr(
  q: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): QueryStringFormat {
  q = q.replace(/^"/, SpecialChar.explicitStart);
  q = q.replace(/"$/, SpecialChar.explicitEnd);

  let mode: LookupMode;
  if (q.startsWith(SpecialChar.explicitStart) && q.endsWith(SpecialChar.explicitEnd)) {
    q = q.slice(1, -1);
    // Wildcards at the beginning/end doesn't make sense if the search is interpreted as exact.
    q = q.replace(/^[*]+|[*]+$/g, "");
    mode = LookupMode.exact;
  } else if (q.startsWith(SpecialChar.explicitStart)) {
    q = q.slice(1);
    mode = LookupMode.endsWith;
  } else if (q.endsWith(SpecialChar.explicitEnd)) {
    q = q.slice(0, -1);
    mode = LookupMode.startsWith;
  } else {
    mode = LookupMode.endsWith;
  }

  // @fixme this is a Morpheus/Bailly concordance rule. It should be extracted from this.
  const preserveAccents: boolean = (() => {
    const qAsBetaCode = toBetaCode(q, KeyType.GREEK, {
      betaCodeStyle: {
        skipSanitization: true,
        useTLGStyle: true
      }
    }).toLowerCase();
    return ["ti\\s"].includes(qAsBetaCode);
  })();

  q = removeGreekVariants(q.trim(), { preserveAccents });

  q = caseSensitive ? q : q.toLowerCase();
  if (!diacriticSensitive) q = removeDiacritics(q, KeyType.GREEK);

  // Remove the eventual extended contract verb form (e.g. '-ῶ'), as the
  // `searchable*` database columns don't use it, contrary to the `word` column.
  q = diacriticSensitive ? q.replace(/(?<=ω)-ῶ$/, "") : q.replace(/(?<=ω)-[ῶω]$/, "");

  // @fixme Add this option to the API?
  const permissive = false;
  q = permissive ? sanitizeGreek(q) : q;

  return {
    searchStr: q,
    lookupMode: mode
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

async function getMorpheusAnalyses(
  greekStr: string,
  caseSensitive: boolean,
  diacriticSensitive: boolean
): Promise<MorpheusResponse<MorpheusAnalysis>> {
  const morpheus = await Morpheus.getMorpheus();

  // @TODO Add a jokers interpreter in `morpheus.lookup()` to support them.
  if (/[*?]/.test(greekStr)) return {};

  return await morpheus.lookup(greekStr, {
    caseSensitive,
    diacriticSensitive
  });
}

function getMorpheusAnalysesSearchableKeys(
  analyses: MorpheusResponse<MorpheusAnalysis>
): string[] {
  // We want the lemma to compare it against one of the database `searchable*` column later.
  return Object.keys(analyses).map((key) => {
    const lemma = parseMorphologyKey(key).lemma;

    const formatted = formatQueryStr(
      lemma,
      true, // Morpheus keys are matched against the `searchable` (case-sensitive) field.
      true // Morpheus keys are matched against the `searchable` (diacritic-sensitive) field.
    );

    return formatted.searchStr;
  });
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
  // Validate the user input against a non-accented string.
  greekStr = removeDiacritics(greekStr, KeyType.GREEK);

  if (!greekStr) return false;
  if (greekStr.length === 1) return /[^α-ωϝ]/i.test(greekStr) === false;
  return (
    greekStr.length < 50 &&
    /[^α-ωϝ\s’\-^$?*"]/i.test(greekStr) === false &&
    /(.)\1{3,}/.test(greekStr) === false
  );
}
/*function isPotentialGreekWord(word: string): boolean {
  return /\p{Script=Greek}/u.test(word) &&
    !/^[0-9]+$/u.test(word) &&
    // Avoid the abbreviations, generally linked to the headword.
    !word.endsWith(".");
}*/

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

  // Convert non-greek inputs to greek.
  if ([KeyType.BETA_CODE, KeyType.TRANSLITERATION].includes(inputMode)) {
    q = toGreek(q, inputMode);
  }

  const { searchStr, lookupMode }: QueryStringFormat = formatQueryStr(
    q,
    caseSensitive,
    diacriticSensitive
  );

  if (!validateQueryStr(searchStr)) {
    if (settings.isDevEnv) {
      console.log(
        `%cInvalid input '${
          removeDiacritics(searchStr, KeyType.GREEK)
        }' (will return an empty response).`,
        "color:orange"
      );
    }
    return emptyResponse();
  }

  // Field `word` is needed to retrieve unique entries and build the `children` property.
  if (!fields.includes("word")) fields.unshift("word");
  const fieldsAsStr: string = fields.join(", ");

  const searchableField: string = formatSearchableField(
    caseSensitive,
    diacriticSensitive
  );

  const morpheusAnalyses = (!skipMorpheus)
    ? await getMorpheusAnalyses(searchStr, caseSensitive, diacriticSensitive)
    : {};

  const morpheusAnalysesSearchableKeys = getMorpheusAnalysesSearchableKeys(
    morpheusAnalyses
  );

  const morpheusSQLStatements: string = morpheusAnalysesSearchableKeys.length
    ? "OR searchable IN (" + morpheusAnalysesSearchableKeys
      .map((_, i) => `$lemma${(i += 1)}`)
      .join(", ") +
      ")"
    : "";

  // Perf: prefer using a strict equality comparison if possible.
  const comparisonOperator = lookupMode === LookupMode.exact && !/[*?]/.test(searchStr)
    ? "="
    : "GLOB";

  // The `word` field is mandatory in order to retrieve unique entries and build the
  // `children` property.
  const sql = `
    SELECT ${fieldsAsStr},
           ${searchableField}, COUNT(*) OVER () AS countAll
    FROM bailly
    WHERE ${searchableField} ${comparisonOperator} $query ${morpheusSQLStatements}
    ORDER BY orderedID
    LIMIT $limit 
  `;

  const params: { [key: string]: any } = {
    $query: (() => {
      switch (lookupMode) {
        case LookupMode.exact:
          return searchStr;
        case LookupMode.startsWith:
          // Don't add a wildcard at the beginning if the user wrote already a joker character.
          return /^[^*?]+/.test(searchStr) ? "*" + searchStr : searchStr;
        case LookupMode.endsWith:
        default:
          // Don't add a wildcard at the end if the user already wrote a joker character.
          return /[^*?]+$/.test(searchStr) ? searchStr + "*" : searchStr;
      }
    })(),
    $limit: (() => {
      if (limit && limit <= settings.queryMaxRows) return limit;
      // @fixme One shouldn't have to think about this special value.
      else return settings.queryMaxRows === Infinity ? -1 : settings.queryMaxRows;
    })()
  };

  morpheusAnalysesSearchableKeys.forEach((lemma, i) => {
    const propName: string = `$lemma${(i += 1)}`;
    params[propName] = lemma;
  });

  /*if (settings.isDevEnv) {
    console.log(`\n${import.meta.url} > getEntries():\n`);
    console.log({
      searchStr: searchStr,
      lookupMode: lookupMode,
      morpheusAnalysesSearchableKeys: morpheusAnalysesSearchableKeys,
      params: params
    });
    console.log(sql);
  }*/

  const data = <PartialExcept<DatabaseEntry, "word">[]> (
    db.prepare(sql).all(params)
  );

  const uniqueEntries = setUniqueEntries(data, { caseSensitive });

  let response: ApiLookupResponse<keyof QueryableFields> | ApiLookupResponse<never> = {
    data: {
      version: settings.dbVersion,
      count: data.length,
      countAll: data[0]?.countAll ?? 0,
      entries: uniqueEntries.map((item) => {
        const searchableFieldValue =
          item[formatSearchableField(caseSensitive, diacriticSensitive)];
        const normalizedSearchStr = caseSensitive ? searchStr : searchStr.toLowerCase();

        const isExact: boolean = normalizedSearchStr === searchableFieldValue;

        const isMorpheus: boolean = (() => {
          if (
            morpheusAnalysesSearchableKeys.length && (
              (lookupMode === LookupMode.exact &&
                searchableFieldValue.length !== searchStr.length) ||
              (/^[α-ω-]|[α-ω’-]$/i.test(normalizedSearchStr) === true &&
                searchableFieldValue.startsWith(normalizedSearchStr) === false)
            )
          ) {
            return true;
          } else {
            return false;
          }
        })();

        const removeExtraFields = (
          item:
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
          delete item.countAll;
          delete item.searchable;
          delete item.searchableCaseInsensitive;
          delete item.searchableAtonic;
          delete item.searchableAtonicCaseInsensitive;
          // Property `word` has been picked in order to group entries (see supra).
          if (!fieldsAsStr.includes("word")) delete item.word;
        };

        removeExtraFields(item);
        item.children?.forEach((child) => removeExtraFields(child));

        return {
          ...item,
          isMorpheus: isMorpheus,
          isExact: isMorpheus || isExact
        };
      })
    }
  };

  if (morphology) {
    response = attachMorphology(
      response,
      Object.fromEntries(
        Object.entries(morpheusAnalyses).map(([lemma, analyses]) => [
          lemma,
          analyses.map(({ morphology }) => morphology)
        ])
      ) as any
    );
  }

  return response;
}
