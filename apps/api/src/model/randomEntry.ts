import type { Dictionary, SqlValue } from "../db/dictionary.ts";
import { getDerivedData } from "./derived.ts";
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

type DrawnEntry = Partial<DatabaseEntry> & { length: number };

/**
 * Candidates drawn per attempt with a `lengthRange` (one statement, as many rows).
 * The home page asks for 400 to 700 characters, which 3.4 % of the entries have:
 * with 32 candidates, a third of the draws found none and fell back to the index
 * (~7 000 rows read, and a second round trip); with 128, 1.2 % of them (~260 rows
 * read on average).
 */
const CANDIDATES = 128;

/**
 * Draws an entry at random, reading as few rows as possible: `ORDER BY random()`
 * over the table would read every row (107 808, which D1 bills) for each draw.
 *
 *   - Without `lengthRange`: a random `orderedID` (the rows are numbered without
 *     gaps, but `>=` tolerates some), one row read.
 *   - With `lengthRange`, when the data has `definitionLength` (cf.
 *     `scripts/db_derive.ts`): random `orderedID`s, kept if their length fits, a few
 *     dozen rows read by primary key; a range that none of them fits (a narrow one)
 *     falls back to a draw over the index of `definitionLength`, which reads only the
 *     index entries of the range.
 *   - Otherwise (no derived data): the draw over the table, as before.
 */
async function drawEntry(
  db: Dictionary,
  selectedFields: string,
  lengthRange: [number, number?] | null
): Promise<DrawnEntry | undefined> {
  const derived = await getDerivedData(db);

  if (!lengthRange) {
    return db.get<DrawnEntry>(`
      SELECT length(definition) AS length, ${selectedFields}
      FROM bailly
      WHERE orderedID >=
        (SELECT abs(random()) % (SELECT MAX(orderedID) FROM bailly) + 1)
      ORDER BY orderedID
      LIMIT 1
    `);
  }

  const [min, max] = lengthRange;
  const rangeSql = max === undefined
    ? "definitionLength >= ?1"
    : "definitionLength >= ?1 AND definitionLength <= ?2";
  const rangeParams: SqlValue[] = max === undefined ? [min] : [min, max];

  if (!derived.definitionLength) {
    return db.get<DrawnEntry>(
      `
      SELECT length(definition) AS length, ${selectedFields}
      FROM bailly
      WHERE ${rangeSql.replaceAll("definitionLength", "length(definition)")}
      ORDER BY random()
      LIMIT 1
    `,
      rangeParams
    );
  }

  const candidates = Array.from(
    { length: CANDIDATES },
    () => 1 + Math.floor(Math.random() * derived.maxOrderedID)
  );

  const drawn = await db.get<DrawnEntry>(
    `
    SELECT definitionLength AS length, ${selectedFields}
    FROM bailly
    WHERE orderedID IN (SELECT value FROM json_each(?${rangeParams.length + 1}))
      AND ${rangeSql}
    ORDER BY random()
    LIMIT 1
  `,
    [...rangeParams, JSON.stringify(candidates)]
  );

  return drawn ?? db.get<DrawnEntry>(
    `
    SELECT definitionLength AS length, ${selectedFields}
    FROM bailly
    WHERE orderedID = (
      SELECT orderedID FROM bailly WHERE ${rangeSql} ORDER BY random() LIMIT 1
    )
  `,
    rangeParams
  );
}

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

  const entry = await drawEntry(db, selectedFields, lengthRange);

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
