import { Database } from "../Database.ts";
import type {
  ApiRandomEntryParams,
  ApiRandomEntryResponse,
  DatabaseEntry,
  Entry,
  QueryableFields
} from "../definitions.ts";
import { Settings } from "../Settings.ts";

export async function getRandomEntry<K extends keyof QueryableFields>({
  fields,
  lengthRange
}: ApiRandomEntryParams<K>): Promise<ApiRandomEntryResponse<K>> {
  const db = await Database.getConnection();
  const settings = Settings.getSettings();
  const fieldsStr: string = fields.join(", ");

  const sql = `
    SELECT length(definition) as length, ${fieldsStr}
    FROM bailly
    ${
      lengthRange
        ? !lengthRange[1]
          ? `WHERE length(definition) >= ${lengthRange[0]}`
          : `WHERE length(definition) >= ${lengthRange[0]} AND length(definition) <= ${lengthRange[1]}`
        : ""
    }
    ORDER BY random()
    LIMIT 1
  `;

  const entry = <(Partial<DatabaseEntry> & { length: number }) | null>(
    db.prepare(sql).get()
  );

  if (!entry) {
    return {
      data: {
        version: settings.dbVersion,
        length: 0,
        entry: {} as Entry<K>
      }
    };
  }

  return {
    data: {
      version: settings.dbVersion,
      length: entry.length,
      entry: (({ length, ...props }) => props)(entry) as Entry<K>
    }
  };
}
