import {
  KeyType,
  removeDiacritics,
  removeGreekVariants,
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
import { setUniqueEntries } from "../helpers.ts";
import { Morpheus } from "../Morpheus.ts";
import { Settings } from "../Settings.ts";
import { type Morphology } from "../MorpheusParser.ts";

type MorphologyKey = {
  lemma: string;
  stem: string;
};

function parseMorphologyKey(key: string): MorphologyKey | undefined {
  const separatorIndex = key.indexOf("|");

  if (separatorIndex === -1) {
    return undefined;
  }

  return {
    lemma: key.slice(0, separatorIndex),
    stem: key.slice(separatorIndex + 1)
  };
}

function attachMorphology<K extends keyof QueryableFields>(
  response: ApiLookupResponse<K> | ApiLookupResponse<never>
): ApiLookupResponse<K> | ApiLookupResponse<never> {
  const entryWords = new Set(response.data.entries.map(({ word }) => word));

  const { byLemma, orphans } = Object.entries(response.data.orphanMorphology)
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
        byLemma: {} as Record<
          string,
          Record<string, Morphology[]>
        >,
        orphans: {} as Record<string, Morphology[]>
      }
    );

  return {
    data: {
      ...response.data,
      orphanMorphology: orphans,
      entries: response.data.entries.map((entry) => ({
        ...entry,
        ...(byLemma[entry.word] && {
          morphology: byLemma[entry.word]
        })
      }))
    }
  };
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

function formatQueryStr(
  str: string,
  isExactMatch: boolean,
  isCaseSensitive: boolean
): string {
  if (!isExactMatch) {
    if (str.endsWith(SpecialChar.explicitEnd)) {
      if (str.startsWith(SpecialChar.wildcard)) str = str.slice(0, -1);
      else str = SpecialChar.wildcard + str.slice(0, -1);
    } else {
      if (!str.endsWith(SpecialChar.wildcard)) str += SpecialChar.wildcard;
    }
  }

  return isCaseSensitive ? str : str.toLowerCase();
}

function formatSearchableField(
  caseSensitive: boolean,
  diacriticSensitive: boolean
): string {
  return `searchable${diacriticSensitive ? "" : "Atonic"}${
    caseSensitive ? "" : "CaseInsensitive"
  }`;
}

/**
 * Returns a string without the extended contract verb form (e.g. '-ῶ'), as the
 * `searchable*` database columns don't use it, contrary to the `word` column.
 * @param greekStr
 */
function normalizeSearchableKey(
  greekStr: string,
  diacriticSensitive: boolean
): string {
  return diacriticSensitive
    ? greekStr.replace(/(?<=ω)-ῶ$/, "")
    : greekStr.replace(/(?<=ω)-[ῶω]$/, "");
}

/**
 * A. Empty string.
 * B. One char: only allow greek letters (digamma included).
 * C. (1) Allow a maximum of 50 characters.
 *    (2) Only allow greek letters (digamma included), spaces
 *        and metacharacters `^`, `$`, `?`, `*` and `"`;
 *    (3) Only allow `^` in first position;
 *    (4) Only allow `$` in last position;
 *    (5) Allow a maximum of three identical characters in a row.
 */
function validateInput(str: string): boolean {
  if (!str) return false;
  if (str.length === 1) return /[^α-ωϝ]/i.test(str) === false;
  return (
    str.length < 50 &&
    /[^α-ωϝ\s^$?*"]/i.test(str) === false &&
    /^.+\^/.test(str) === false &&
    /\$.+$/.test(str) === false &&
    /(.)\1{3,}/.test(str) === false
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
  const morpheus = await Morpheus.getMorpheus();
  const settings = Settings.getSettings();

  if ([KeyType.BETA_CODE, KeyType.TRANSLITERATION].includes(inputMode)) {
    q = toGreek(q, inputMode);
  }

  const fieldsAsStr: string = fields.join(", ");

  const isExactMatch: boolean = (q.startsWith("^") && q.endsWith("$")) ||
    (q.startsWith('"') && q.endsWith('"'));

  if (isExactMatch) {
    q = q.slice(1, -1);
  } else if (q.startsWith(SpecialChar.explicitStart) || q.startsWith('"')) {
    q = q.slice(1);
  }

  if (!diacriticSensitive) q = removeDiacritics(q, KeyType.GREEK);

  const searchStr: string = normalizeSearchableKey(
    removeGreekVariants(q.trim()),
    diacriticSensitive
  );

  if (!validateInput(removeDiacritics(searchStr, KeyType.GREEK))) {
    return emptyResponse();
  }

  const comparisonOperator: string = isExactMatch ? "=" : "GLOB";

  const searchableField: string = formatSearchableField(
    caseSensitive,
    diacriticSensitive
  );

  const morpheusAnalyses = !skipMorpheus
    ? await morpheus.lookup(searchStr, { caseSensitive, diacriticSensitive })
    : {};

  // We want the lemma to compare it against one of the database `searchable*` column later.
  const morpheusAnalysesSearchableKeys = Object.keys(morpheusAnalyses).map((
    key
  ) => normalizeSearchableKey(parseMorphologyKey(key).lemma, diacriticSensitive));

  if (settings.isDevEnv) {
    console.info(
      "%c./src/model/lookup.ts > getEntries():",
      "font-weight:bold",
      "morpheusAnalysesSearchableKeys =",
      morpheusAnalysesSearchableKeys
    );
  }

  const morpheusSQLStatements: string = (() => {
    if (morpheusAnalysesSearchableKeys.length) {
      return "OR searchable IN (" + morpheusAnalysesSearchableKeys
        .map((_, i) => `$lemma${(i += 1)}`)
        .join(", ") +
        ")";
    }
    return "";
  })();

  // The `word` field is mandatory in order to retrieve unique entries and build the
  // `children` property.
  const sql = `
    SELECT ${!fieldsAsStr.includes("word") ? `word, ${fieldsAsStr}` : fieldsAsStr},
           ${searchableField}, COUNT(*) OVER () AS countAll
    FROM bailly
    WHERE ${searchableField} ${comparisonOperator} $query ${morpheusSQLStatements}
    ORDER BY orderedID
    LIMIT $limit 
  `;

  const params: { [key: string]: any } = {
    $query: formatQueryStr(searchStr, isExactMatch, caseSensitive),
    $limit: (() => {
      if (limit && limit <= settings.queryMaxRows) return limit;
      // @fixme One shouldn't have to think about this special value.
      else return settings.queryMaxRows === Infinity ? -1 : settings.queryMaxRows;
    })()
  };

  morpheusAnalysesSearchableKeys.forEach((lemma, i) => {
    const propName: string = `$lemma${(i += 1)}`;
    params[propName] = removeGreekVariants(lemma);
  });

  /*if (Deno.env.get("DENO_ENV") === "development") {
    console.info(`\n${import.meta.url} > getEntries():\n`);
    console.log({
      searchStr: searchStr,
      morpheusAnalysesSearchableKeys: morpheusAnalysesSearchableKeys,
      params: params,
    });
    console.log(sql);
  }*/

  const data = <PartialExcept<DatabaseEntry, "word">[]> (
    db.prepare(sql).all(params)
  );

  if (!data.length) return emptyResponse();

  const uniqueEntries = setUniqueEntries(data, { caseSensitive });

  const response = attachMorphology({
    data: {
      version: settings.dbVersion,
      count: data.length,
      countAll: data[0]?.countAll ?? NaN,
      // This is post-processed by `attachMorphology()` (see supra).
      orphanMorphology: (() => {
        if (morphology) {
          return Object.fromEntries(
            Object.entries(morpheusAnalyses).map(([lemma, analyses]) => [
              lemma,
              analyses.map(({ morphology }) => morphology)
            ])
          );
        }
        return {} as any;
      })(),
      entries: uniqueEntries.map((item) => {
        const searchableFieldValue =
          item[formatSearchableField(caseSensitive, diacriticSensitive)];
        const normalizedSearchStr = caseSensitive ? searchStr : searchStr.toLowerCase();

        const isExact: boolean = normalizedSearchStr === searchableFieldValue;

        const isMorpheus: boolean = (() => {
          if (!morpheusAnalysesSearchableKeys.length) {
            return false;
          } else if (
            isExactMatch && searchableFieldValue.length !== searchStr.length
          ) {
            return true;
          } else {
            return !searchableFieldValue.startsWith(normalizedSearchStr);
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
          // Property `word` has been picked in order to group entries.
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
  });

  if (!settings.isDevEnv) {
    delete response.data.orphanMorphology;
  }

  return response;
}
