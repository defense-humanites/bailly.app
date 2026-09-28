import type { Database } from "db0";
import type { WriteCharge } from "./lockers";
import { DAY, dayOf } from "./lockers";

/**
 * The daily budget of an address for the synchronization lockers, against
 * their creation in series to fill the database (cf. `audit-abus-casiers.md`):
 * the bytes its writes add (cf. `writeCharge`), and the number of lockers it
 * creates. Counted in bytes rather than in lockers, so that a class behind
 * one address passes (a new locker weighs a few KB), while a script is
 * stopped after a couple of full lockers.
 *
 * The addresses are not stored as such: only an HMAC of them (pseudonymous),
 * keyed with a random salt drawn by the server for the day (and a secret of
 * the server, if configured); salts and counters are deleted after two days
 * (and from the backups of the database after their own retention).
 */

export type BudgetLimits = {
  /**
   * Bytes a day per address (0: no limit).
   */
  bytes: number;
  /**
   * Lockers created a day per address (0: no limit).
   */
  creations: number;
  /**
   * Bytes a day per address added to the lockers in use (0: no limit).
   */
  growth: number;
  /**
   * A secret of the server, if configured, mixed with the salt of the day: a
   * copy of the database alone then tells nothing of the addresses (without
   * it, the addresses could be found again by trying them all, as long as
   * the salt of their day is kept).
   */
  secret?: string;
};

/**
 * No limit (the largest 32-bit integer, for PostgreSQL's `INTEGER`).
 */
const NO_LIMIT = 2_147_483_647;

/**
 * The part of an address that identifies a network: the address itself for
 * IPv4 (IPv4-mapped IPv6 included), its first 56 bits for IPv6 (a household
 * or a site usually gets a /56 or a /48, a mobile device a /64).
 * @returns `null` for something that is not an IP address.
 */
export function addressKey(address: string): string | null {
  // Without a port, brackets nor zone.
  const trimmed = address.trim()
    .replace(/^\[(.+)\](?::\d+)?$/, "$1")
    .replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1")
    .replace(/%.*$/, "");
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(trimmed);
  if (v4) return v4.slice(1).every(part => Number(part) <= 255) ? v4.slice(1).map(Number).join(".") : null;

  const groups = ipv6Groups(trimmed);
  if (!groups) return null;
  // IPv4-mapped (::ffff:a.b.c.d).
  if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xFFFF) {
    return [groups[6]! >> 8, groups[6]! & 0xFF, groups[7]! >> 8, groups[7]! & 0xFF].join(".");
  }
  // The first 56 bits: 3 groups and a half.
  return `${groups.slice(0, 3).map(group => group.toString(16)).join(":")}:${(groups[3]! >> 8).toString(16)}/56`;
}

/**
 * The 8 groups of an IPv6 address (with `::`, and a dotted IPv4 ending).
 */
function ipv6Groups(address: string): number[] | null {
  if (!address.includes(":")) return null;
  let text = address.toLowerCase();

  // A dotted IPv4 ending, as two groups.
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (v4) {
    const bytes = v4.slice(1).map(Number);
    if (bytes.some(byte => byte > 255)) return null;
    text = `${text.slice(0, v4.index)}${((bytes[0]! << 8) | bytes[1]!).toString(16)}:${((bytes[2]! << 8) | bytes[3]!).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (half: string): number[] | null => {
    if (!half) return [];
    const parts = half.split(":");
    if (parts.some(part => !/^[\da-f]{1,4}$/.test(part))) return null;
    return parts.map(part => Number.parseInt(part, 16));
  };
  const head = parse(halves[0]!);
  const tail = halves.length === 2 ? parse(halves[1]!) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  if (head.length + tail.length > 7) return null;
  return [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail];
}

let schemaReady: WeakMap<Database, Promise<void>> = new WeakMap();

async function ensureSchema(db: Database): Promise<void> {
  let ready = schemaReady.get(db);
  if (!ready) {
    ready = (async () => {
      await db.sql`CREATE TABLE IF NOT EXISTS sync_budgets (
        address TEXT NOT NULL,
        day INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        creations INTEGER NOT NULL,
        growth INTEGER NOT NULL,
        PRIMARY KEY (address, day)
      )`;
      await db.sql`CREATE TABLE IF NOT EXISTS sync_salts (
        day INTEGER PRIMARY KEY,
        salt TEXT NOT NULL
      )`;
    })();
    ready.catch(() => schemaReady.delete(db));
    schemaReady.set(db, ready);
  }
  await ready;
}

/**
 * Forgets the prepared databases and the salts (for the tests).
 */
export function resetBudgetCache(): void {
  schemaReady = new WeakMap();
  salts = new Map();
}

/**
 * The HMAC keys of the days, by database (a salt is drawn once a day, by the
 * first instance that needs it; the counters and salts of the days before
 * yesterday are then deleted).
 */
let salts = new Map<string, Promise<CryptoKey>>();
const databases = new WeakMap<Database, string>();

async function saltKey(db: Database, day: number, secret = ""): Promise<CryptoKey> {
  let dbId = databases.get(db);
  if (!dbId) {
    dbId = crypto.randomUUID();
    databases.set(db, dbId);
  }
  const cacheKey = `${dbId}:${secret}:${day}`;
  let key = salts.get(cacheKey);
  if (!key) {
    key = (async () => {
      const drawn = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      await db.sql`INSERT INTO sync_salts (day, salt) VALUES (${day}, ${drawn}) ON CONFLICT (day) DO NOTHING`;
      const { rows } = await db.sql`SELECT salt FROM sync_salts WHERE day = ${day}`;
      const salt = (rows?.[0] as { salt: string } | undefined)?.salt ?? drawn;
      // A failed cleanup must not block the writes (the next day retries).
      await purgeBudgets(db, day * DAY).catch((e: unknown) => {
        console.error("Purge of the synchronization budgets failed", e);
      });
      return crypto.subtle.importKey("raw", new TextEncoder().encode(`${salt}:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    })();
    key.catch(() => salts.delete(cacheKey));
    // Only today's key is useful.
    for (const other of salts.keys()) if (!other.endsWith(`:${day}`)) salts.delete(other);
    salts.set(cacheKey, key);
  }
  return key;
}

async function hashAddress(db: Database, key: string, day: number, secret?: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await saltKey(db, day, secret), new TextEncoder().encode(key));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Adds a write to the budget of its address for the day, if it fits.
 * @param address The address of the client, if known (without one, e.g. in
 * development, nothing is counted).
 * @returns Whether the write fits in the budget (it is then counted).
 */
export async function chargeBudget(
  db: Database,
  address: string | null | undefined,
  charge: WriteCharge,
  limits: BudgetLimits,
  now: number = Date.now(),
): Promise<boolean> {
  if (!charge.bytes && !charge.creations && !charge.growth) return true;
  const key = address ? addressKey(address) : null;
  if (!key) return true;
  const max = (limit: number): number => (limit > 0 ? Math.min(limit, NO_LIMIT) : NO_LIMIT);
  const maxBytes = max(limits.bytes);
  const maxCreations = max(limits.creations);
  const maxGrowth = max(limits.growth);
  if (maxBytes === NO_LIMIT && maxCreations === NO_LIMIT && maxGrowth === NO_LIMIT) return true;
  if (charge.bytes > maxBytes || charge.creations > maxCreations || charge.growth > maxGrowth) return false;

  await ensureSchema(db);
  const day = dayOf(now);
  const hashed = await hashAddress(db, key, day, limits.secret);
  // Counted only if it fits (a refused write does not use the budget).
  const { rows } = await db.sql`INSERT INTO sync_budgets (address, day, bytes, creations, growth)
    VALUES (${hashed}, ${day}, ${charge.bytes}, ${charge.creations}, ${charge.growth})
    ON CONFLICT (address, day) DO UPDATE
      SET bytes = sync_budgets.bytes + excluded.bytes,
        creations = sync_budgets.creations + excluded.creations,
        growth = sync_budgets.growth + excluded.growth
      WHERE sync_budgets.bytes + excluded.bytes <= ${maxBytes}
        AND sync_budgets.creations + excluded.creations <= ${maxCreations}
        AND sync_budgets.growth + excluded.growth <= ${maxGrowth}
    RETURNING bytes`;
  return Boolean(rows?.length);
}

/**
 * Deletes the counters and the salts older than yesterday.
 */
export async function purgeBudgets(db: Database, now: number = Date.now()): Promise<void> {
  await ensureSchema(db);
  const day = dayOf(now);
  await db.sql`DELETE FROM sync_budgets WHERE day < ${day - 1}`;
  await db.sql`DELETE FROM sync_salts WHERE day < ${day - 1}`;
}

/**
 * The seconds until the next day (UTC), when the budgets start over.
 */
export function secondsUntilTomorrow(now: number = Date.now()): number {
  return Math.ceil(((dayOf(now) + 1) * DAY - now) / 1000);
}
