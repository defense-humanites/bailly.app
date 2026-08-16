import { KeyType } from "greek-conversion";
import type {
  ApiParams,
  DatabaseEntry,
  Entry,
  NonEmptyArray,
  Optional,
  PartialExcept,
  QueryableFields
} from "./definitions.ts";
import { Settings } from "./Settings.ts";

export function setParams(
  params: Record<string, unknown>
): ApiParams<keyof QueryableFields> {
  return {
    q: setQueryParam(params.q),
    inputMode: setInputMode(params.inputMode),
    fields: setSelectedFields(params.fields),
    morphology: setBooleanParam(params.morphology),
    caseSensitive: setBooleanParam(params.caseSensitive),
    diacriticSensitive: setBooleanParam(params.diacriticSensitive),
    lengthRange: setNumericRangeParam(params.lengthRange),
    limit: setNumericParam(params.limit),
    offset: setNumericParam(params.offset),
    siblings: setBooleanParam(params.siblings),
    skipMorpheus: setBooleanParam(params.skipMorpheus)
  };
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function setBooleanParam(param?: unknown): boolean {
  if (param === undefined) return false;
  const paramAsStr: string = String(param).trim();
  return paramAsStr !== "false" && paramAsStr !== "0";
}

export function setInputMode(param?: unknown): KeyType {
  switch (param) {
    case "betacode":
      return KeyType.BETA_CODE;
    case "transliteration":
      return KeyType.TRANSLITERATION;
    case "greek":
    default:
      return KeyType.GREEK;
  }
}

export function setNumericParam(param?: unknown): number | undefined {
  const value: number = Number(param);

  if (Number.isNaN(value) || value < 1 || !Number.isInteger(value)) {
    return undefined;
  }

  return Number(param);
}

export function setNumericRangeParam(
  param?: unknown
): [number, number?] | null {
  let arr: number[] = [];

  if (Array.isArray(param) || typeof param === "string") {
    if (typeof param === "string") {
      arr = param.split(",").map((item) => Number.parseInt(item, 10));
    }

    arr = arr.sort((a, b) => a - b);

    if (!arr.length || arr.some((item) => Number.isNaN(item))) return null;
    return arr.length > 1 ? [arr[0], arr[1]] : [arr[0]];
  }

  return null;
}

/**
 * Returns a decoded, trimmed and Unicode-normalized string representing one or multiple queries.
 * @privateRemarks Always normalize Unicode-sensitive strings like polytonic greek strings.
 * @param param A query passed in the URL (GET) or in a Response body (POST).
 */
export function setQueryParam(param?: unknown): string {
  if (Array.isArray(param)) {
    return param.map((query) => String(query).trim()).join(",").normalize();
  }

  // The param can be encoded (GET) or not (POST); it can be a string (GET) or other types (POST).
  param = safeDecodeURIComponent(String(param) ?? "");

  // First split the param in order to trim all its (potential) parts.
  return param.split(",").map((query) => query.trim()).join(",").normalize();
}

export function setSelectedFields(
  fields?: unknown
): NonEmptyArray<keyof QueryableFields> {
  const settings = Settings.getSettings();
  const formattedFields = Settings.formatFields(String(fields) ?? "");

  const selectedFields = settings.checkFields(formattedFields)
    ? formattedFields
    : settings.queryDefaultFields;

  return selectedFields as NonEmptyArray<keyof QueryableFields>;
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
