import { KeyType } from "greek-conversion";
import type {
  ApiParams,
  ApiRawParams,
  DatabaseEntry,
  Entry,
  NonEmptyArray,
  Optional,
  PartialExcept,
  QueryableFields
} from "./definitions.ts";
import { Settings } from "./Settings.ts";

export function setParams(params: ApiRawParams): ApiParams<any> {
  return {
    q: decodeURIComponent(params.q ?? "").trim(),
    inputMode: setinputMode(params.inputMode),
    fields: setSelectedFields(params.fields),
    morphology: setBooleanParam(params.morphology),
    caseSensitive: setBooleanParam(params.caseSensitive),
    lengthRange: setNumericRangeParam(params.lengthRange),
    limit: setNumericParam(params.limit),
    offset: setNumericParam(params.offset),
    siblings: setBooleanParam(params.siblings),
    skipMorpheus: setBooleanParam(params.skipMorpheus)
  };
}

export function setBooleanParam(param?: string): boolean {
  return param !== undefined && param !== "false";
}

export function setinputMode(param?: string): KeyType {
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

export function setNumericParam(param?: string): number | undefined {
  const value: number = Number(param);

  if (Number.isNaN(value) || value < 1 || !Number.isInteger(value)) {
    return undefined;
  }

  return Number(param);
}

export function setNumericRangeParam(param?: string): [number, number?] | null {
  const arr: number[] = (param ?? "")
    .split(",")
    .map((item) => Number.parseInt(item, 10))
    .sort((a, b) => a - b);

  if (!arr.length || arr.some((item) => Number.isNaN(item))) return null;
  return arr.length > 1 ? [arr[0], arr[1]] : [arr[0]];
}

export function setSelectedFields(
  fields?: string
): NonEmptyArray<keyof QueryableFields> {
  const settings = Settings.getSettings();
  const formattedFields = Settings.formatFields(fields ?? "");

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
): (PartialExcept<Entry, "word" | "children"> &
  Optional<
    DatabaseEntry,
    "searchableAtonic" | "searchableAtonicCaseInsensitive"
  >)[] {
  const uniqueEntries: PartialExcept<Entry, "word">[] = [];
  for (const [word, entries] of Object.entries(
    Object.groupBy(inputEntries, ({ word }) => word)
  )) {
    if (!entries) continue;

    if (entries.length > 1) {
      // Create a common entry and place the actual entries as children.
      const entry: PartialExcept<Entry<"word">, "word" | "children"> &
        Optional<
          DatabaseEntry,
          "searchableAtonic" | "searchableAtonicCaseInsensitive"
        > = {
        ...entries[0]
      };

      // @ts-ignore: @fixme
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

export async function runTimeLimitedPromise<T>(
  promise: Promise<T>,
  timer?: number
): Promise<T> {
  timer = timer ?? Settings.getSettings().morpheusLookupMaxDuration ?? 1000;

  const timedPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error("timed out")), timer)
  );

  return await Promise.race([promise, timedPromise]);
}
