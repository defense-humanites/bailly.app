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
  MorpheusData,
  Optional,
  PartialExcept,
  QueryableFields
} from "../definitions.ts";
import { SpecialChar } from "../enums.ts";
import { setUniqueEntries } from "../helpers.ts";
import { Morpheus } from "../Morpheus.ts";
import { Settings } from "../Settings.ts";

function emptyResponse(): ApiLookupResponse<never> {
  return {
    data: {
      version: Settings.getSettings().dbVersion,
      count: 0,
      countAll: 0,
      morphology: {},
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

  const isExactMatch: boolean =
    (q.startsWith("^") && q.endsWith("$")) ||
    (q.startsWith('"') && q.endsWith('"'));

  if (isExactMatch) {
    q = q.slice(1, -1);
  } else if (q.startsWith(SpecialChar.explicitStart) || q.startsWith('"')) {
    q = q.slice(1);
  }

  // Make the query string searchable.
  const searchStr: string = removeGreekVariants(
    removeDiacritics(q.trim(), KeyType.GREEK)
  );

  if (!validateInput(searchStr)) return emptyResponse();

  const comparisonOperator: string = isExactMatch ? "=" : "GLOB";

  const [_searchableField, searchableAtonicField]: string[] = caseSensitive
    ? ["searchable", "searchableAtonic"]
    : ["searchableCaseInsensitive", "searchableAtonicCaseInsensitive"];

  const morpheusData: MorpheusData = !skipMorpheus
    ? await morpheus.lookup(searchStr, { caseSensitive })
    : {};

  const morpheusSQLStatements: string = Object.keys(morpheusData)
    .map((_, i) => `OR searchable = $lemma${(i += 1)} `)
    .join("");

  // Field `word` is mandatory in order to retrieve unique entries
  // and build the `children` property.
  const sql = `
    SELECT ${
      !fieldsAsStr.includes("word") ? `word, ${fieldsAsStr}` : fieldsAsStr
    }, ${searchableAtonicField}, (
      SELECT COUNT(orderedID)
      FROM bailly
      WHERE ${searchableAtonicField} ${comparisonOperator} $query ${morpheusSQLStatements}
    ) as countAll
    FROM bailly
    WHERE ${searchableAtonicField} ${comparisonOperator} $query ${morpheusSQLStatements}
    ORDER BY orderedID
    LIMIT $limit 
  `;

  const params: { [key: string]: any } = {
    $query: formatQueryStr(searchStr, isExactMatch, caseSensitive),
    $limit: (() => {
      if (limit && limit <= settings.queryMaxRows) return limit;
      else return settings.queryMaxRows;
    })()
  };

  Object.keys(morpheusData).forEach((lemma, i) => {
    const propName: string = `$lemma${(i += 1)}`;
    params[propName] = removeGreekVariants(lemma);
  });

  if (Deno.env.get("NODE_ENV") === "development") {
    console.log({
      searchStr: searchStr,
      morpheusData: Object.keys(morpheusData),
      params: params
    });
    console.log(sql);
  }

  const data = <PartialExcept<DatabaseEntry, "word">[]>(
    db.prepare(sql).all(params)
  );

  if (!data.length) return emptyResponse();

  const uniqueEntries = setUniqueEntries(data, { caseSensitive });

  return {
    data: {
      version: settings.dbVersion,
      count: data.length,
      countAll: data[0].countAll ?? -1,
      morphology: morphology ? morpheusData : undefined,
      entries: uniqueEntries.map((item) => {
        const isExact: boolean = (() => {
          return caseSensitive
            ? searchStr === item.searchableAtonic
            : searchStr.toLowerCase() === item.searchableAtonicCaseInsensitive;
        })();

        const isMorpheus: boolean = (() => {
          if (!Object.keys(morpheusData).length) return false;

          return caseSensitive
            ? !item.searchableAtonic?.startsWith(searchStr)
            : !item.searchableAtonicCaseInsensitive?.startsWith(
                searchStr.toLowerCase()
              );
        })();

        const removeExtraFields = (
          item: Partial<Entry> &
            Optional<
              DatabaseEntry,
              | "countAll"
              | "searchableAtonic"
              | "searchableAtonicCaseInsensitive"
            >
        ): void => {
          // Property `word` has been picked in order to group entries.
          if (!fieldsAsStr.includes("word")) delete item.word;

          delete item.countAll;

          caseSensitive
            ? delete item.searchableAtonic
            : delete item.searchableAtonicCaseInsensitive;
        };

        removeExtraFields(item);
        item.children?.forEach((child) => removeExtraFields(child));

        return {
          ...item,
          isMorpheus: isMorpheus,
          isExact: isMorpheus || isExact
        } as Entry<K>;
      })
    }
  };
}
