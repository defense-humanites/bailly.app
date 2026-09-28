import type { Database } from "db0";
import { MAX_LOCKER_BLOB_LENGTH } from "#shared/utils/sync";

/**
 * The lockers of the bookmarks synchronization: one per synchronization key,
 * holding the bookmarks encrypted on the devices (the server cannot read
 * them), with a version number for optimistic concurrency. The devices
 * derive from their key the locker's id and a token (cf. `app/sync/crypto.ts`);
 * the server only keeps a hash of the token.
 *
 * Retention (cf. `purgeLockers`): the content of a locker is only a copy of
 * the bookmarks of its devices, which send it again whenever they find the
 * locker empty. So a locker is emptied rather than deleted (its row stays,
 * and the key stays known): after 548 days without any access; after 30 days
 * if it was created in a series (beyond 20 creations by the same address in
 * a day, cf. `syncBudget.ts`) and never accessed after the day of its
 * creation (most likely an abuse: the early emptying never concerns a user
 * alone, whose browser may itself have deleted the bookmarks meanwhile, as
 * Safari does after 7 days without a visit). Its row is deleted after 3 years
 * without any access.
 */

/**
 * The id of a locker: 16 bytes in base64url.
 */
export const LOCKER_ID_PATTERN = /^[\w-]{22}$/;
/**
 * The access token: 32 bytes in base64url.
 */
export const TOKEN_PATTERN = /^[\w-]{43}$/;
const BLOB_PATTERN = /^[\w-]+$/;
/**
 * The largest locker content (the bookmarks, compressed then encrypted, in
 * base64url).
 */
export const MAX_BLOB_LENGTH = MAX_LOCKER_BLOB_LENGTH;

export const DAY = 24 * 60 * 60 * 1000;
/**
 * Beyond this many lockers created by an address in a day, the next ones are
 * created in a series.
 */
export const SERIES_CREATIONS = 20;
/**
 * A locker created in a series, never accessed after the day of its
 * creation, is emptied after this many days.
 */
export const SERIES_MAX_DAYS = 30;
/**
 * A locker accessed after the day of its creation, and created at least this
 * many days ago, is established: its growth counts in a budget of the server
 * of its own (cf. `syncBudget.ts`), which recent lockers cannot use up.
 */
export const ESTABLISHED_DAYS = 30;
/**
 * A locker is emptied after this many days without any access (about 18
 * months).
 */
export const IDLE_MAX_DAYS = 548;
/**
 * The row of a locker (emptied or deleted) is removed after this many days
 * without any access (3 years).
 */
export const ROW_MAX_DAYS = 3 * 365;
/**
 * The most rows a purge statement handles (the next purges handle the rest).
 */
const PURGE_BATCH = 500;
/**
 * What a new row weighs besides its content (id, token hash, numbers and
 * index entries), counted in the budget of the address that creates it.
 */
export const ROW_OVERHEAD = 256;

/**
 * The day (UTC) of a time, as a number of days since the epoch.
 */
export const dayOf = (time: number): number => Math.floor(time / DAY);

type LockerRow = {
  version: number;
  blob: string;
  token_hash: string;
  deleted: number;
  created_day: number;
  seen_day: number;
};

/**
 * `empty`: emptied by the purge, to be filled again by the devices.
 * `deleted`: deleted by a device (the others must stop synchronizing).
 */
export type ReadResult
  = | { state: "found"; version: number; blob: string }
    | { state: "empty" }
    | { state: "missing" }
    | { state: "deleted" };

/**
 * `conflict`: the locker changed since the version the device read.
 */
export type WriteResult
  = | { state: "written"; version: number }
    | { state: "conflict"; version: number }
    | { state: "missing" }
    | { state: "deleted" };

export type DeleteResult = { state: "deleted" } | { state: "missing" };

let schemaReady: WeakMap<Database, Promise<void>> = new WeakMap();

/**
 * Runs a schema statement that may already have been applied (a column
 * added by another instance meanwhile, e.g.).
 */
async function tolerate(statement: Promise<unknown>): Promise<void> {
  try {
    await statement;
  } catch (e: unknown) {
    // Already applied; anything else is logged (the next statements fail,
    // and the preparation is tried again at the next request).
    if (!/duplicate column|already exists/i.test(String(e))) console.error("Schema statement failed", e);
  }
}

/**
 * Creates the table if needed (once per database instance), and adds the
 * columns of the retention to a table created before them.
 * @remarks Prepared statements rather than `exec`, which D1 runs line by
 * line.
 */
export async function ensureSchema(db: Database): Promise<void> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = (async () => {
      await db.sql`CREATE TABLE IF NOT EXISTS sync_lockers (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        version INTEGER NOT NULL,
        blob TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        created_day INTEGER NOT NULL DEFAULT 0,
        seen_day INTEGER NOT NULL DEFAULT 0,
        series INTEGER NOT NULL DEFAULT 0
      )`;
      // A table created before the retention: its lockers count as accessed
      // on the day of their last write (and as created long ago).
      await tolerate(db.sql`ALTER TABLE sync_lockers ADD COLUMN created_day INTEGER NOT NULL DEFAULT 0`);
      await tolerate(db.sql`ALTER TABLE sync_lockers ADD COLUMN seen_day INTEGER NOT NULL DEFAULT 0`);
      await tolerate(db.sql`ALTER TABLE sync_lockers ADD COLUMN series INTEGER NOT NULL DEFAULT 0`);
      await db.sql`DROP INDEX IF EXISTS sync_lockers_updated_at`;
      // For the purges (and the migration below): partial indexes, holding
      // only the candidates of each purge (their conditions are repeated
      // word for word in the purges, so that SQLite uses them).
      await db.sql`CREATE INDEX IF NOT EXISTS sync_lockers_seen_day ON sync_lockers (seen_day)`;
      await db.sql`CREATE INDEX IF NOT EXISTS sync_lockers_series ON sync_lockers (created_day)
        WHERE series = 1 AND seen_day <= created_day AND deleted = 0 AND blob <> ''`;
      await db.sql`CREATE INDEX IF NOT EXISTS sync_lockers_filled ON sync_lockers (seen_day)
        WHERE deleted = 0 AND blob <> ''`;
      await backfill(db);
    })();
    ready.catch(() => schemaReady.delete(db));
    schemaReady.set(db, ready);
  }
  await ready;
}

/**
 * The lockers written without the columns of the retention (a table created
 * before them, or an instance of the previous version during a deployment)
 * count as accessed on the day of their last write.
 */
async function backfill(db: Database): Promise<void> {
  await db.sql`UPDATE sync_lockers SET seen_day = CAST(updated_at / ${DAY} AS INTEGER) WHERE seen_day = 0`;
}

/**
 * Forgets the prepared databases (for the tests).
 */
export function resetSchemaCache(): void {
  schemaReady = new WeakMap();
}

/**
 * Compares two hashes in constant time.
 */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The SHA-256 hash of a token (hexadecimal).
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidBlob(blob: unknown): blob is string {
  return typeof blob === "string" && blob.length > 0 && blob.length <= MAX_BLOB_LENGTH && BLOB_PATTERN.test(blob);
}

async function getRow(db: Database, id: string): Promise<LockerRow | undefined> {
  const { rows } = await db.sql`SELECT version, blob, token_hash, deleted, created_day, seen_day
    FROM sync_lockers WHERE id = ${id}`;
  return rows?.[0] as LockerRow | undefined;
}

/**
 * Records an access to a locker: at most one write a day.
 */
async function touch(db: Database, id: string, today: number): Promise<void> {
  await db.sql`UPDATE sync_lockers SET seen_day = ${today} WHERE id = ${id} AND seen_day < ${today}`;
}

/**
 * Reads a locker (an access). A wrong token reads as a missing locker
 * (which does not reveal that it exists).
 */
export async function readLocker(db: Database, id: string, tokenHash: string, now: number = Date.now()): Promise<ReadResult> {
  await ensureSchema(db);
  const row = await getRow(db, id);
  if (!row || !sameHash(row.token_hash, tokenHash)) return { state: "missing" };
  if (row.seen_day < dayOf(now)) await touch(db, id, dayOf(now));
  if (row.deleted) return { state: "deleted" };
  if (!row.blob) return { state: "empty" };
  return { state: "found", version: row.version, blob: row.blob };
}

/**
 * What a write would add to the database, for the daily budget of its
 * address (cf. `syncBudget.ts`):
 * - `bytes`: a creation (its size and the weight of its row), the growth of
 *   a locker never accessed after the day of its creation, the filling again
 *   of a locker emptied (unless emptied after a long inactivity: a device
 *   coming back);
 * - `creations`: a creation;
 * - `growth`: the growth of the other lockers (the bookmarks added by their
 *   users), in a budget of its own, larger: the users already synchronized
 *   behind an address (a school, a mobile network) are not blocked by the
 *   lockers created there; `established` for a locker created 30 days ago or
 *   more (cf. `ESTABLISHED_DAYS`).
 * A write that the server will refuse (wrong token, deleted locker) counts
 * nothing.
 */
export type WriteCharge = { bytes: number; creations: number; growth: number; established?: boolean };

const FREE: WriteCharge = { bytes: 0, creations: 0, growth: 0 };

export async function writeCharge(
  db: Database,
  id: string,
  tokenHash: string,
  expectedVersion: number,
  blob: string,
  now: number = Date.now(),
): Promise<WriteCharge> {
  await ensureSchema(db);
  const { rows } = await db.sql`SELECT token_hash, deleted, created_day, seen_day, length(blob) AS size
    FROM sync_lockers WHERE id = ${id}`;
  const row = rows?.[0] as { token_hash: string; deleted: number; created_day: number; seen_day: number; size: number } | undefined;
  if (!row) return expectedVersion === 0 ? { bytes: blob.length + ROW_OVERHEAD, creations: 1, growth: 0 } : FREE;
  if (row.deleted || !sameHash(row.token_hash, tokenHash)) return FREE;

  const added = Math.max(0, blob.length - row.size);
  const confirmed = row.seen_day > row.created_day;
  if (!row.size) {
    // Emptied: after a long inactivity (only a locker that old can be), free
    // (a device coming back); early, as created in a series (then read, to be
    // filled), as a creation.
    return confirmed && row.created_day < dayOf(now) - IDLE_MAX_DAYS ? FREE : { bytes: added, creations: 0, growth: 0 };
  }
  if (!confirmed) return { bytes: added, creations: 0, growth: 0 };
  return { bytes: 0, creations: 0, growth: added, established: row.created_day <= dayOf(now) - ESTABLISHED_DAYS };
}

/**
 * Writes a locker if it is still at the version the device read (an
 * access). `0`: the device creates it, or fills it again once emptied.
 * @param options.series Whether a locker created now is created in a series
 * (cf. `SERIES_CREATIONS`).
 */
export async function writeLocker(
  db: Database,
  id: string,
  tokenHash: string,
  expectedVersion: number,
  blob: string,
  now: number = Date.now(),
  { series = false }: { series?: boolean } = {},
): Promise<WriteResult> {
  await ensureSchema(db);
  const today = dayOf(now);

  let written: { version: number } | undefined;
  if (expectedVersion === 0) {
    const { rows } = await db.sql`INSERT INTO sync_lockers (id, token_hash, version, blob, deleted, updated_at, created_day, seen_day, series)
      VALUES (${id}, ${tokenHash}, 1, ${blob}, 0, ${now}, ${today}, ${today}, ${series ? 1 : 0})
      ON CONFLICT (id) DO NOTHING RETURNING version`;
    written = rows?.[0] as { version: number } | undefined;
    if (!written) {
      // Emptied: filled again, at its next version.
      const { rows: refilled } = await db.sql`UPDATE sync_lockers
        SET version = version + 1, blob = ${blob}, updated_at = ${now}, seen_day = ${today}
        WHERE id = ${id} AND token_hash = ${tokenHash} AND blob = '' AND deleted = 0
        RETURNING version`;
      written = refilled?.[0] as { version: number } | undefined;
    }
  } else {
    const { rows } = await db.sql`UPDATE sync_lockers
      SET version = version + 1, blob = ${blob}, updated_at = ${now}, seen_day = ${today}
      WHERE id = ${id} AND token_hash = ${tokenHash} AND version = ${expectedVersion} AND deleted = 0
      RETURNING version`;
    written = rows?.[0] as { version: number } | undefined;
  }
  if (written) return { state: "written", version: written.version };

  const row = await getRow(db, id);
  if (!row || !sameHash(row.token_hash, tokenHash)) return { state: "missing" };
  if (row.seen_day < today) await touch(db, id, today);
  if (row.deleted) return { state: "deleted" };
  return { state: "conflict", version: row.version };
}

/**
 * Deletes the content of a locker, keeping a mark so that the other devices
 * know to stop synchronizing (rather than recreating it).
 */
export async function deleteLocker(db: Database, id: string, tokenHash: string, now: number = Date.now()): Promise<DeleteResult> {
  await ensureSchema(db);
  const { rows } = await db.sql`UPDATE sync_lockers SET blob = '', deleted = 1, updated_at = ${now}, seen_day = ${dayOf(now)}
    WHERE id = ${id} AND token_hash = ${tokenHash} RETURNING id`;
  return rows?.length ? { state: "deleted" } : { state: "missing" };
}

/**
 * Empties the lockers created in a series and never accessed after the day
 * of their creation (after 30 days) and the idle ones (after 548 days without
 * access); deletes the rows left without access for 3 years (deletion marks
 * included). By batches: the next purges handle the rest.
 */
export async function purgeLockers(db: Database, now: number = Date.now()): Promise<void> {
  await ensureSchema(db);
  await backfill(db);
  const today = dayOf(now);
  await db.sql`UPDATE sync_lockers SET blob = '' WHERE id IN (
    SELECT id FROM sync_lockers
    WHERE series = 1 AND seen_day <= created_day AND deleted = 0 AND blob <> '' AND created_day < ${today - SERIES_MAX_DAYS}
    LIMIT ${PURGE_BATCH})`;
  await db.sql`UPDATE sync_lockers SET blob = '' WHERE id IN (
    SELECT id FROM sync_lockers
    WHERE deleted = 0 AND blob <> '' AND seen_day < ${today - IDLE_MAX_DAYS} AND seen_day > 0
    LIMIT ${PURGE_BATCH})`;
  await db.sql`DELETE FROM sync_lockers WHERE id IN (
    SELECT id FROM sync_lockers WHERE seen_day < ${today - ROW_MAX_DAYS} AND seen_day > 0 LIMIT ${PURGE_BATCH})`;
}
