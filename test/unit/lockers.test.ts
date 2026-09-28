import { createDatabase, type Database } from "db0";
import sqlite from "db0/connectors/node-sqlite";
import { beforeEach, expect, test } from "vitest";
import {
  DAY,
  deleteLocker,
  hashToken,
  IDLE_MAX_DAYS,
  isValidBlob,
  purgeLockers,
  readLocker,
  resetSchemaCache,
  ROW_MAX_DAYS,
  ROW_OVERHEAD,
  SERIES_MAX_DAYS,
  writeCharge,
  writeLocker,
} from "../../server/lib/lockers";

let db: Database;
let hash: string;

beforeEach(async () => {
  resetSchemaCache();
  db = createDatabase(sqlite({ name: ":memory:" }));
  hash = await hashToken("a".repeat(43));
});

const id = "b".repeat(22);

test("create, read, then update a locker at the version read", async () => {
  expect(await readLocker(db, id, hash)).toEqual({ state: "missing" });

  expect(await writeLocker(db, id, hash, 0, "first")).toEqual({ state: "written", version: 1 });
  expect(await readLocker(db, id, hash)).toEqual({ state: "found", version: 1, blob: "first" });

  expect(await writeLocker(db, id, hash, 1, "second")).toEqual({ state: "written", version: 2 });
  expect(await readLocker(db, id, hash)).toEqual({ state: "found", version: 2, blob: "second" });
});

test("a device that read an older version gets a conflict (and the current version)", async () => {
  await writeLocker(db, id, hash, 0, "first");
  await writeLocker(db, id, hash, 1, "second");

  expect(await writeLocker(db, id, hash, 1, "stale")).toEqual({ state: "conflict", version: 2 });
  expect(await writeLocker(db, id, hash, 0, "stale")).toEqual({ state: "conflict", version: 2 });
  expect(await readLocker(db, id, hash)).toMatchObject({ blob: "second" });
});

test("a wrong token reads and writes as a missing locker", async () => {
  await writeLocker(db, id, hash, 0, "first");
  const other = await hashToken("c".repeat(43));

  expect(await readLocker(db, id, other)).toEqual({ state: "missing" });
  expect(await writeLocker(db, id, other, 1, "intrusion")).toEqual({ state: "missing" });
  expect(await writeLocker(db, id, other, 0, "intrusion")).toEqual({ state: "missing" });
  expect(await deleteLocker(db, id, other)).toEqual({ state: "missing" });
  expect(await readLocker(db, id, hash)).toMatchObject({ blob: "first" });
});

test("a deleted locker stays deleted, so that the other devices stop", async () => {
  await writeLocker(db, id, hash, 0, "first");
  expect(await deleteLocker(db, id, hash)).toEqual({ state: "deleted" });

  expect(await readLocker(db, id, hash)).toEqual({ state: "deleted" });
  expect(await writeLocker(db, id, hash, 1, "again")).toEqual({ state: "deleted" });
  expect(await writeLocker(db, id, hash, 0, "again")).toEqual({ state: "deleted" });
});

test("a locker created in a series, never accessed after the day of its creation, is emptied after 30 days, its row kept", async () => {
  const created = Date.UTC(2026, 0, 10, 12);
  const other = "d".repeat(22);
  const alone = "e".repeat(22);
  await writeLocker(db, id, hash, 0, "abuse", created, { series: true });
  await writeLocker(db, other, hash, 0, "used", created, { series: true });
  // Not in a series (a user alone, whose browser may have deleted the
  // bookmarks meanwhile): never emptied early.
  await writeLocker(db, alone, hash, 0, "alone", created);
  // Accessed the same day (does not count), then the next day (counts).
  await readLocker(db, id, hash, created + 60_000);
  await readLocker(db, other, hash, created + DAY);

  await purgeLockers(db, created + SERIES_MAX_DAYS * DAY);
  expect(await readLocker(db, id, hash, created)).toMatchObject({ state: "found" });

  await purgeLockers(db, created + (SERIES_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, hash)).toEqual({ state: "empty" });
  expect(await readLocker(db, other, hash)).toMatchObject({ state: "found", blob: "used" });
  expect(await readLocker(db, alone, hash)).toMatchObject({ state: "found", blob: "alone" });
});

test("an emptied locker is filled again at version 0, at its next version", async () => {
  const created = Date.UTC(2026, 0, 10);
  await writeLocker(db, id, hash, 0, "first", created);
  await writeLocker(db, id, hash, 1, "second", created);
  await purgeLockers(db, created + (IDLE_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, hash)).toEqual({ state: "empty" });

  expect(await writeLocker(db, id, hash, 0, "again")).toEqual({ state: "written", version: 3 });
  expect(await readLocker(db, id, hash)).toEqual({ state: "found", version: 3, blob: "again" });
  // A second device filling it meanwhile gets a conflict (it merges first).
  expect(await writeLocker(db, id, hash, 0, "other")).toEqual({ state: "conflict", version: 3 });
  // Not with another token.
  await purgeLockers(db, Date.now() + (IDLE_MAX_DAYS + 1) * DAY);
  expect(await writeLocker(db, id, await hashToken("c".repeat(43)), 0, "intrusion")).toEqual({ state: "missing" });
});

test("idle lockers: emptied after 548 days without access, deleted after 3 years", async () => {
  const start = Date.UTC(2026, 0, 10);
  const read = "d".repeat(22);
  await writeLocker(db, id, hash, 0, "idle", start);
  await writeLocker(db, read, hash, 0, "read", start);
  // Only read (a device whose bookmarks do not change): still in use.
  await readLocker(db, read, hash, start + 400 * DAY);

  await purgeLockers(db, start + (IDLE_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, hash, start)).toEqual({ state: "empty" });
  expect(await readLocker(db, read, hash, start)).toMatchObject({ state: "found" });

  await purgeLockers(db, start + (ROW_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, hash)).toEqual({ state: "missing" });
});

test("a deletion mark stays as long as devices ask for it, 3 years without access otherwise", async () => {
  const start = Date.UTC(2026, 0, 10);
  await writeLocker(db, id, hash, 0, "first", start);
  await deleteLocker(db, id, hash, start);
  // An old device asks for it after 2 years: still deleted (not recreated).
  expect(await readLocker(db, id, hash, start + 2 * 365 * DAY)).toEqual({ state: "deleted" });
  expect(await writeLocker(db, id, hash, 0, "resurrected", start + 2 * 365 * DAY)).toEqual({ state: "deleted" });

  await purgeLockers(db, start + (2 * 365 + ROW_MAX_DAYS - 1) * DAY);
  expect(await readLocker(db, id, hash, start)).toEqual({ state: "deleted" });
  await purgeLockers(db, start + (2 * 365 + ROW_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, hash)).toEqual({ state: "missing" });
});

test("the charge of a write, for the daily budget of its address", async () => {
  const created = Date.UTC(2026, 0, 10);
  const charge = (bytes: number, creations = 0, growth = 0) => ({ bytes, creations, growth });
  // A creation: its content and its row.
  expect(await writeCharge(db, id, hash, 0, "abcd", created)).toEqual(charge(4 + ROW_OVERHEAD, 1));
  // Refused (missing): nothing.
  expect(await writeCharge(db, id, hash, 3, "abcd", created)).toEqual(charge(0));

  await writeLocker(db, id, hash, 0, "abcd", created);
  // Never accessed after the day of its creation: its growth, as bytes.
  expect(await writeCharge(db, id, hash, 1, "abcdefg", created)).toEqual(charge(3));
  expect(await writeCharge(db, id, hash, 1, "ab", created)).toEqual(charge(0));
  // Accessed on a later day: its growth still counts, in its own budget (a
  // script could create tiny lockers, read them the next day, then fill them).
  await readLocker(db, id, hash, created + DAY);
  expect(await writeCharge(db, id, hash, 1, "abcdefg", created + DAY)).toEqual({ ...charge(0, 0, 3), established: false });
  // Created 30 days ago or more: established (a budget of the server of its own).
  expect(await writeCharge(db, id, hash, 1, "abcdefg", created + 30 * DAY)).toEqual({ ...charge(0, 0, 3), established: true });
  // Another token: nothing (the write will be refused).
  expect(await writeCharge(db, id, await hashToken("c".repeat(43)), 1, "abcdefg", created + DAY)).toEqual(charge(0));

  // Filling again a locker emptied after a long inactivity: free (a device
  // coming back).
  const later = created + (IDLE_MAX_DAYS + 2) * DAY;
  await purgeLockers(db, later);
  await readLocker(db, id, hash, later);
  expect(await writeCharge(db, id, hash, 0, "abcdefg", later)).toEqual(charge(0));

  // Created in a series and emptied early, then read (which confirms it) to
  // be filled: counted as bytes, as a creation would.
  const other = "d".repeat(22);
  await writeLocker(db, other, hash, 0, "abcd", created, { series: true });
  const week = created + (SERIES_MAX_DAYS + 1) * DAY;
  await purgeLockers(db, week);
  expect(await readLocker(db, other, hash, week)).toEqual({ state: "empty" });
  expect(await writeCharge(db, other, hash, 0, "abcdefg", week)).toEqual(charge(7));
  expect(await writeCharge(db, other, hash, 2, "abcdefg", week)).toEqual(charge(7));

  // Deleted: nothing (refused).
  await deleteLocker(db, other, hash);
  expect(await writeCharge(db, other, hash, 0, "abcdefg")).toEqual(charge(0));
});

test("the growth of a day is counted net: shrinking then growing again costs nothing more", async () => {
  const day = Date.UTC(2026, 0, 10);
  const charge = (growth: number) => ({ bytes: 0, creations: 0, growth, established: false });
  await writeLocker(db, id, hash, 0, "a".repeat(100), day);
  await readLocker(db, id, hash, day + DAY); // Confirmed.

  const next = day + DAY;
  expect(await writeCharge(db, id, hash, 1, "a".repeat(150), next)).toEqual(charge(50));
  await writeLocker(db, id, hash, 1, "a".repeat(150), next);
  await writeLocker(db, id, hash, 2, "a", next);
  // Back to 150: already paid today; beyond, only the difference.
  expect(await writeCharge(db, id, hash, 3, "a".repeat(150), next)).toEqual(charge(0));
  expect(await writeCharge(db, id, hash, 3, "a".repeat(160), next)).toEqual(charge(10));

  // The next day, from the size at its start.
  expect(await writeCharge(db, id, hash, 3, "a".repeat(150), next + DAY)).toEqual(charge(149));
});

test("the index of a previous version is dropped", async () => {
  await db.sql`CREATE TABLE sync_lockers (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, version INTEGER NOT NULL, blob TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
  )`;
  await db.sql`CREATE INDEX sync_lockers_unconfirmed ON sync_lockers (updated_at)`;
  await readLocker(db, id, hash);
  const { rows } = await db.sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sync_lockers'`;
  expect(rows?.map(row => row.name)).not.toContain("sync_lockers_unconfirmed");
});

test("an emptied locker, with another token: missing", async () => {
  const created = Date.UTC(2026, 0, 10);
  await writeLocker(db, id, hash, 0, "first", created, { series: true });
  await purgeLockers(db, created + (SERIES_MAX_DAYS + 1) * DAY);
  expect(await readLocker(db, id, await hashToken("c".repeat(43)))).toEqual({ state: "missing" });
});

test("lockers written without the retention's columns (during a deployment) are not purged at once", async () => {
  await readLocker(db, id, hash); // The schema.
  const now = Date.UTC(2026, 0, 10);
  await db.sql`INSERT INTO sync_lockers (id, token_hash, version, blob, deleted, updated_at) VALUES (${id}, ${hash}, 1, 'kept', 0, ${now})`;

  await purgeLockers(db, now + 30 * DAY);
  expect(await readLocker(db, id, hash)).toMatchObject({ state: "found", blob: "kept" });
});

test("the purges read only their candidates (partial indexes)", async () => {
  await readLocker(db, id, hash); // The schema.
  const plan = async (query: string) => JSON.stringify(await db.prepare(`EXPLAIN QUERY PLAN ${query}`).all());
  expect(await plan("SELECT id FROM sync_lockers WHERE series = 1 AND seen_day <= created_day AND deleted = 0 AND blob <> '' AND created_day < 5 LIMIT 500"))
    .toContain("sync_lockers_series");
  expect(await plan("SELECT id FROM sync_lockers WHERE deleted = 0 AND blob <> '' AND seen_day < 5 AND seen_day > 0 LIMIT 500"))
    .toContain("sync_lockers_filled");
});

test("a table created before the retention is migrated, its lockers kept", async () => {
  const old = Date.UTC(2026, 0, 10);
  await db.sql`CREATE TABLE sync_lockers (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, version INTEGER NOT NULL, blob TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
  )`;
  await db.sql`INSERT INTO sync_lockers (id, token_hash, version, blob, deleted, updated_at) VALUES (${id}, ${hash}, 4, 'kept', 0, ${old})`;

  // Accessed on the day of its last write, created long ago: not emptied as
  // never accessed.
  await purgeLockers(db, old + 30 * DAY);
  expect(await readLocker(db, id, hash)).toEqual({ state: "found", version: 4, blob: "kept" });
});

test("blobs", () => {
  expect(isValidBlob("AbC-_09")).toBe(true);
  expect(isValidBlob("")).toBe(false);
  expect(isValidBlob("a+b")).toBe(false);
  expect(isValidBlob("a".repeat(500_000))).toBe(true);
  expect(isValidBlob("a".repeat(500_001))).toBe(false);
});

test("the purges have indexes", async () => {
  await readLocker(db, id, hash);
  const { rows } = await db.sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sync_lockers'`;
  expect(rows?.map(row => row.name)).toEqual(expect.arrayContaining(["sync_lockers_seen_day", "sync_lockers_series", "sync_lockers_filled"]));
});
