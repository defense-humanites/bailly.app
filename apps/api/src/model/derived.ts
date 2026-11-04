/**
 * The data derived from the dictionary by `scripts/db_derive.ts` (cf. its header),
 * as the lookups use it. A database without it (revision 4 and before) still works:
 * every optimization falls back to the plain statements, with a warning at startup.
 *
 * The derived data is read once per `Dictionary` (per process, or per isolate on
 * Workers): the list of the rows out of index order, and which structures exist.
 */

import type { Dictionary } from "../db/dictionary.ts";
import { Shared } from "../shared.ts";

/** The search columns, in the order of `formatSearchableField()`'s combinations. */
export const SEARCH_COLUMNS = [
  "searchableAtonicCaseInsensitive",
  "searchableCaseInsensitive",
  "searchableAtonic",
  "searchable"
] as const;

export type SearchColumn = typeof SEARCH_COLUMNS[number];

/**
 * Beyond this many rows out of index order, a column keeps the sorting statement:
 * the exclusion list would cost more than it saves.
 */
export const UNORDERED_MAX_ROWS = 500;

/** Longest prefix counted by `bailly_prefix_count` (cf. `scripts/db_derive.ts`). */
export const PREFIX_COUNT_MAX_LENGTH = 4;

/** The key reversed, by code point (the keys are NFC, without combining marks). */
export function reverseKey(key: string): string {
  return [...key].reverse().join("");
}

/** The column holding the reversed keys of a search column. */
export function reversedColumn(column: SearchColumn): string {
  return `reversed${column.charAt(0).toUpperCase()}${column.slice(1)}`;
}

export type UnorderedRow = { orderedID: number; key: string };

export type DerivedData = {
  /** The largest `orderedID` (the rows are numbered from 1, without gaps so far). */
  maxOrderedID: number;
  /**
   * Per column with a stored list: the rows out of index order, with their key in
   * that column (the lookups keep those the query matches, cf. `lookup.ts`).
   */
  unordered: ReadonlyMap<SearchColumn, readonly UnorderedRow[]>;
  prefixCounts: boolean;
  reversedKeys: boolean;
  definitionLength: boolean;
};

const cache = new WeakMap<Dictionary, Shared<DerivedData>>();

/**
 * The derived data of a dictionary, read on the first call and shared by the
 * following ones (cf. `Shared`: never a pending read of another, canceled request).
 */
export function getDerivedData(db: Dictionary): Promise<DerivedData> {
  let data = cache.get(db);

  if (!data) {
    data = new Shared(() => loadDerivedData(db));
    cache.set(db, data);
  }

  return data.get();
}

async function loadDerivedData(db: Dictionary): Promise<DerivedData> {
  const [names, [{ maxOrderedID } = { maxOrderedID: 0 }]] = await db.batch<
    { name: string } & { maxOrderedID: number }
  >([
    {
      sql: `SELECT name FROM sqlite_master
            WHERE name IN ('bailly_unordered', 'bailly_prefix_count',
                           'ix_bailly_definitionLength', ${
        SEARCH_COLUMNS.map((column) => `'ix_bailly_${reversedColumn(column)}'`)
          .join(", ")
      })`
    },
    { sql: "SELECT MAX(orderedID) AS maxOrderedID FROM bailly" }
  ]) as unknown as [{ name: string }[], { maxOrderedID: number }[]];

  const objects = new Set(names.map(({ name }) => name));

  if (!objects.size) {
    console.warn(
      "⚠️ No derived data in the database (cf. scripts/db_derive.ts): the " +
        "lookups read every match."
    );
    return {
      maxOrderedID,
      unordered: new Map(),
      prefixCounts: false,
      reversedKeys: false,
      definitionLength: false
    };
  }

  const unordered = new Map<SearchColumn, UnorderedRow[]>();

  if (objects.has("bailly_unordered")) {
    for (
      const { column, orderedID, key } of await db.all<{
        column: SearchColumn;
        orderedID: number;
        key: string;
      }>(
        `SELECT u.column, u.orderedID,
                CASE u.column ${
          SEARCH_COLUMNS.map((column) => `WHEN '${column}' THEN b.${column}`).join(" ")
        } END AS key
         FROM bailly_unordered AS u JOIN bailly AS b ON b.orderedID = u.orderedID
         ORDER BY u.column, u.orderedID`
      )
    ) {
      let rows = unordered.get(column);
      if (!rows) unordered.set(column, rows = []);
      rows.push({ orderedID, key });
    }
  }

  return {
    maxOrderedID,
    unordered,
    prefixCounts: objects.has("bailly_prefix_count"),
    reversedKeys: SEARCH_COLUMNS.every((column) =>
      objects.has(`ix_bailly_${reversedColumn(column)}`)
    ),
    definitionLength: objects.has("ix_bailly_definitionLength")
  };
}
