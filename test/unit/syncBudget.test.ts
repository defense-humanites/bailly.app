import { createDatabase, type Database } from "db0";
import sqlite from "db0/connectors/node-sqlite";
import { beforeEach, expect, test } from "vitest";
import { DAY } from "../../server/lib/lockers";
import { addressKey, chargeBudget, purgeBudgets, resetBudgetCache, secondsUntilTomorrow } from "../../server/lib/syncBudget";

let db: Database;

beforeEach(() => {
  resetBudgetCache();
  db = createDatabase(sqlite({ name: ":memory:" }));
});

const limits = { bytes: 1_000, creations: 3, growth: 5_000 };
const creation = (bytes: number) => ({ bytes, creations: 1, growth: 0 });
const growth = (bytes: number) => ({ bytes: 0, creations: 0, growth: bytes });

test("the key of an address: IPv4 whole, IPv6 by /56", () => {
  expect(addressKey("203.0.113.7")).toBe("203.0.113.7");
  expect(addressKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  expect(addressKey("::FFFF:cb00:7107")).toBe("203.0.113.7");
  expect(addressKey("2001:db8:abcd:12ff:1:2:3:4")).toBe("2001:db8:abcd:12/56");
  expect(addressKey("2001:db8:abcd:1200::1")).toBe("2001:db8:abcd:12/56");
  expect(addressKey("2001:db8:abcd:12aa::")).toBe("2001:db8:abcd:12/56");
  expect(addressKey("fe80::1%eth0")).toBe("fe80:0:0:0/56");
  expect(addressKey("::1")).toBe("0:0:0:0/56");
  // With a port, in brackets.
  expect(addressKey("203.0.113.7:443")).toBe("203.0.113.7");
  expect(addressKey("[2001:db8:abcd:12ff::1]:443")).toBe("2001:db8:abcd:12/56");
  expect(addressKey("[2001:db8:abcd:12ff::1]")).toBe("2001:db8:abcd:12/56");
  for (const invalid of ["", "localhost", "256.0.0.1", "1.2.3", "2001:db8::1::2", "2001:db8:0:0:0:0:0:0:1", "12345::", "g::1"]) {
    expect(addressKey(invalid), invalid).toBeNull();
  }
});

test("a budget in bytes and in creations, per address and per day", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  expect((await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).fits).toBe(true);
  expect((await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).fits).toBe(true);
  // Beyond the bytes: refused, and not counted.
  expect((await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).fits).toBe(false);
  expect((await chargeBudget(db, "203.0.113.7", creation(200), limits, now)).fits).toBe(true);
  // Beyond the creations.
  expect((await chargeBudget(db, "203.0.113.7", creation(0), limits, now)).fits).toBe(false);
  // The growth of the lockers in use: in its own budget.
  expect((await chargeBudget(db, "203.0.113.7", growth(4_000), limits, now)).fits).toBe(true);
  expect((await chargeBudget(db, "203.0.113.7", growth(1_001), limits, now)).fits).toBe(false);
  expect((await chargeBudget(db, "203.0.113.7", growth(1_000), limits, now)).fits).toBe(true);

  // Another address, the same /56, the next day.
  expect((await chargeBudget(db, "203.0.113.8", creation(400), limits, now)).fits).toBe(true);
  expect((await chargeBudget(db, "2001:db8:abcd:1201::1", creation(600), limits, now)).fits).toBe(true);
  expect((await chargeBudget(db, "2001:db8:abcd:12ff::2", creation(600), limits, now)).fits).toBe(false);
  expect((await chargeBudget(db, "203.0.113.7", creation(400), limits, now + DAY)).fits).toBe(true);
});

test("without an address or limits, nothing is counted", async () => {
  expect((await chargeBudget(db, undefined, creation(5_000), limits)).fits).toBe(true);
  expect((await chargeBudget(db, "not an address", creation(5_000), limits)).fits).toBe(true);
  expect((await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 0, growth: 0 })).fits).toBe(true);
  expect((await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 1, growth: 0 })).fits).toBe(true);
  expect((await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 1, growth: 0 })).fits).toBe(false);
});

test("the addresses are not stored, and the counters and salts go after two days", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  await chargeBudget(db, "203.0.113.7", creation(10), limits, now);
  const { rows } = await db.sql`SELECT address FROM sync_budgets`;
  expect(rows).toHaveLength(1);
  expect(String(rows?.[0]?.address)).not.toContain("203.0.113");
  expect(String(rows?.[0]?.address)).toMatch(/^[\da-f]{64}$/);

  // A new salt each day: the same address gives another hash.
  await chargeBudget(db, "203.0.113.7", creation(10), limits, now + DAY);
  const { rows: both } = await db.sql`SELECT DISTINCT address FROM sync_budgets`;
  expect(both).toHaveLength(2);

  await purgeBudgets(db, now + DAY);
  expect((await db.sql`SELECT day FROM sync_budgets`).rows).toHaveLength(2);
  await purgeBudgets(db, now + 2 * DAY);
  expect((await db.sql`SELECT day FROM sync_budgets`).rows).toHaveLength(1);
  expect((await db.sql`SELECT day FROM sync_salts`).rows).toHaveLength(1);
});

test("the lockers created by an address today are counted (for the series)", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  expect(await chargeBudget(db, "203.0.113.7", creation(10), limits, now)).toEqual({ fits: true, creations: 1 });
  expect(await chargeBudget(db, "203.0.113.7", creation(10), limits, now)).toEqual({ fits: true, creations: 2 });
  // A write that creates nothing: 0.
  expect(await chargeBudget(db, "203.0.113.7", growth(10), limits, now)).toEqual({ fits: true, creations: 0 });
  // Without an address: not counted.
  expect(await chargeBudget(db, undefined, creation(10), limits, now)).toEqual({ fits: true, creations: 0 });
});

test("the budget of the server: all the addresses together", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  const server = { ...limits, total: 1_500 };
  expect(await chargeBudget(db, "203.0.113.7", creation(800), server, now)).toEqual({ fits: true, creations: 1 });
  expect(await chargeBudget(db, "198.51.100.1", creation(800), server, now)).toEqual({ fits: false, scope: "server" });
  expect(await chargeBudget(db, "198.51.100.2", growth(700), server, now)).toEqual({ fits: true, creations: 0 });
  // Also without an address.
  expect(await chargeBudget(db, undefined, growth(1), server, now)).toEqual({ fits: false, scope: "server" });
  // The next day, again.
  expect((await chargeBudget(db, "198.51.100.1", creation(800), server, now + DAY)).fits).toBe(true);
  // An address beyond its own budget: refused as such.
  expect(await chargeBudget(db, "203.0.113.7", creation(900), { ...server, total: 100_000 }, now)).toEqual({ fits: false, scope: "address" });
});

test("the growth of the established lockers: a budget of the server of its own", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  const server = { bytes: 10_000, creations: 10, growth: 10_000, total: 1_000, totalEstablished: 2_000 };
  const established = (bytes: number) => ({ ...growth(bytes), established: true });
  // The other budget spent (e.g. by an abuse)…
  expect((await chargeBudget(db, "203.0.113.7", creation(1_000), server, now)).fits).toBe(true);
  expect(await chargeBudget(db, "198.51.100.1", growth(1), server, now)).toEqual({ fits: false, scope: "server" });
  // … the users of established lockers still write.
  expect((await chargeBudget(db, "198.51.100.1", established(1_500), server, now)).fits).toBe(true);
  expect(await chargeBudget(db, "198.51.100.2", established(600), server, now)).toEqual({ fits: false, scope: "server" });
});

test("a secret of the server changes the pseudonyms of the addresses", async () => {
  const now = Date.UTC(2026, 0, 10, 12);
  await chargeBudget(db, "203.0.113.7", creation(10), limits, now);
  await chargeBudget(db, "203.0.113.7", creation(10), { ...limits, secret: "s3cret" }, now);
  const { rows } = await db.sql`SELECT address, bytes FROM sync_budgets`;
  expect(rows).toHaveLength(2);
});

test("the budgets start over at midnight (UTC)", () => {
  expect(secondsUntilTomorrow(Date.UTC(2026, 0, 10, 23, 59, 30))).toBe(30);
});
