import type { Database } from "db0";

/**
 * The lockers of the bookmarks synchronization: one per synchronization key,
 * holding the bookmarks encrypted on the devices (the server cannot read
 * them), with a version number for optimistic concurrency. The devices
 * derive from their key the locker's id and a token (cf. `app/sync/crypto.ts`);
 * the server only keeps a hash of the token.
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
 * base64url): about 750 KB, far beyond the application's limits.
 */
export const MAX_BLOB_LENGTH = 1_000_000;
/**
 * Lockers left unchanged for longer (about 18 months) are purged.
 */
export const LOCKER_MAX_IDLE = 548 * 24 * 60 * 60 * 1000;

type LockerRow = { version: number; blob: string; token_hash: string; deleted: number };

/**
 * `deleted`: deleted by a device (the others must stop synchronizing).
 */
export type ReadResult
  = | { state: "found"; version: number; blob: string }
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
 * Creates the table if needed (once per database instance).
 */
export async function ensureSchema(db: Database): Promise<void> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = db.exec(`CREATE TABLE IF NOT EXISTS sync_lockers (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      version INTEGER NOT NULL,
      blob TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`).then(() => undefined);
    ready.catch(() => schemaReady.delete(db));
    schemaReady.set(db, ready);
  }
  await ready;
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
  const { rows } = await db.sql`SELECT version, blob, token_hash, deleted FROM sync_lockers WHERE id = ${id}`;
  return rows?.[0] as LockerRow | undefined;
}

/**
 * Reads a locker. A wrong token reads as a missing locker (which does not
 * reveal that it exists).
 */
export async function readLocker(db: Database, id: string, tokenHash: string): Promise<ReadResult> {
  await ensureSchema(db);
  const row = await getRow(db, id);
  if (!row || !sameHash(row.token_hash, tokenHash)) return { state: "missing" };
  if (row.deleted) return { state: "deleted" };
  return { state: "found", version: row.version, blob: row.blob };
}

/**
 * Writes a locker if it is still at the version the device read (`0`: the
 * device creates it).
 */
export async function writeLocker(
  db: Database,
  id: string,
  tokenHash: string,
  expectedVersion: number,
  blob: string,
  now: number = Date.now(),
): Promise<WriteResult> {
  await ensureSchema(db);

  const { rows } = expectedVersion === 0
    ? await db.sql`INSERT INTO sync_lockers (id, token_hash, version, blob, deleted, updated_at)
        VALUES (${id}, ${tokenHash}, 1, ${blob}, 0, ${now})
        ON CONFLICT (id) DO NOTHING RETURNING version`
    : await db.sql`UPDATE sync_lockers SET version = version + 1, blob = ${blob}, updated_at = ${now}
        WHERE id = ${id} AND token_hash = ${tokenHash} AND version = ${expectedVersion} AND deleted = 0
        RETURNING version`;

  const written = rows?.[0] as { version: number } | undefined;
  if (written) return { state: "written", version: written.version };

  const row = await getRow(db, id);
  if (!row || !sameHash(row.token_hash, tokenHash)) return { state: "missing" };
  if (row.deleted) return { state: "deleted" };
  return { state: "conflict", version: row.version };
}

/**
 * Deletes the content of a locker, keeping a mark so that the other devices
 * know to stop synchronizing (rather than recreating it).
 */
export async function deleteLocker(db: Database, id: string, tokenHash: string, now: number = Date.now()): Promise<DeleteResult> {
  await ensureSchema(db);
  const { rows } = await db.sql`UPDATE sync_lockers SET blob = '', deleted = 1, updated_at = ${now}
    WHERE id = ${id} AND token_hash = ${tokenHash} RETURNING id`;
  return rows?.length ? { state: "deleted" } : { state: "missing" };
}

/**
 * Removes the lockers (and deletion marks) left unchanged for too long.
 */
export async function purgeLockers(db: Database, now: number = Date.now()): Promise<void> {
  await ensureSchema(db);
  await db.sql`DELETE FROM sync_lockers WHERE updated_at < ${now - LOCKER_MAX_IDLE}`;
}
