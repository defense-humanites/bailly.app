import type { Dictionary, SqlValue } from "../db/dictionary.ts";
import type {
  ApiRandomEntryParams,
  ApiRandomEntryResponse,
  DatabaseEntry,
  Entry,
  QueryableFields,
  Siblings
} from "../definitions.ts";
import { Settings } from "../Settings.ts";
import { getEntry } from "./entry.ts";

/**
 * @param siblings Adds the siblings of the drawn entry, exactly as `GET /entry/:uri`
 *   gives them for its URI (computed by `getEntry()`): those of its whole group for
 *   an homonym (e.g. `anô_(2)#2`), a single one at either end of the dictionary.
 *   `lengthRange` only filters the drawn entry, never its siblings.
 * @param siblingsFields The fields of the siblings, `fields` by default.
 */
export async function getRandomEntry<
  K extends keyof QueryableFields,
  S extends keyof QueryableFields = K
>(
  db: Dictionary,
  {
    fields,
    lengthRange,
    siblings: getSiblings,
    siblingsFields
  }: ApiRandomEntryParams<K, S>
): Promise<ApiRandomEntryResponse<K, S>> {
  const settings = Settings.getSettings();
  const fieldsStr: string = fields.join(", ");

  // The URI is needed to find the siblings, even if it is not requested.
  const uriRequested = (fields as string[]).includes("uri");
  const selectedFields = getSiblings && !uriRequested ? `${fieldsStr}, uri` : fieldsStr;

  const params: SqlValue[] = lengthRange
    ? lengthRange[1] ? [lengthRange[0], lengthRange[1]] : [lengthRange[0]]
    : [];

  const sql = `
    SELECT length(definition) as length, ${selectedFields}
    FROM bailly
    ${
    lengthRange
      ? !lengthRange[1]
        ? "WHERE length(definition) >= ?1"
        : "WHERE length(definition) >= ?1 AND length(definition) <= ?2"
      : ""
  }
    ORDER BY random()
    LIMIT 1
  `;

  const entry = await db.get<Partial<DatabaseEntry> & { length: number }>(sql, params);

  if (!entry) {
    return {
      data: {
        version: settings.dbVersion,
        length: 0,
        entry: {} as Entry<K>,
        ...(getSiblings && { siblings: {} })
      }
    };
  }

  const { length, ...props } = entry;
  const uri = entry.uri;

  // The URI was only added to find the siblings.
  if (!uriRequested) delete props.uri;

  const siblings = getSiblings && uri
    ? (await getEntry<"uri", S>(db, {
      q: uri,
      fields: ["uri"],
      siblings: true,
      siblingsFields: siblingsFields ??
        (fields as unknown as NonNullable<typeof siblingsFields>)
    })).data.siblings
    : undefined;

  return {
    data: {
      version: settings.dbVersion,
      length,
      entry: props as Entry<K>,
      ...(getSiblings && { siblings: siblings ?? ({} as Siblings<S>) })
    }
  };
}
