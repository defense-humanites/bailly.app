import { createDatabase, type Database } from "db0";
import sqlite from "db0/connectors/node-sqlite";
import { beforeEach, expect, test } from "vitest";
import {
  deleteLocker,
  hashToken,
  isValidBlob,
  LOCKER_MAX_IDLE,
  purgeLockers,
  readLocker,
  resetSchemaCache,
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

test("idle lockers are purged", async () => {
  const now = Date.now();
  await writeLocker(db, id, hash, 0, "old", now - LOCKER_MAX_IDLE - 1);
  await writeLocker(db, "d".repeat(22), hash, 0, "recent", now);

  await purgeLockers(db, now);
  expect(await readLocker(db, id, hash)).toEqual({ state: "missing" });
  expect(await readLocker(db, "d".repeat(22), hash)).toMatchObject({ state: "found" });
});

test("blobs", () => {
  expect(isValidBlob("AbC-_09")).toBe(true);
  expect(isValidBlob("")).toBe(false);
  expect(isValidBlob("a+b")).toBe(false);
  expect(isValidBlob("a".repeat(1_000_001))).toBe(false);
});

test("the purge of the idle lockers has an index", async () => {
  await readLocker(db, id, hash);
  const { rows } = await db.sql`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sync_lockers'`;
  expect(rows?.map(row => row.name)).toContain("sync_lockers_updated_at");
});
