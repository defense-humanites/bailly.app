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
  expect(await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).toBe(true);
  expect(await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).toBe(true);
  // Beyond the bytes: refused, and not counted.
  expect(await chargeBudget(db, "203.0.113.7", creation(400), limits, now)).toBe(false);
  expect(await chargeBudget(db, "203.0.113.7", creation(200), limits, now)).toBe(true);
  // Beyond the creations.
  expect(await chargeBudget(db, "203.0.113.7", creation(0), limits, now)).toBe(false);
  // The growth of the lockers in use: in its own budget.
  expect(await chargeBudget(db, "203.0.113.7", growth(4_000), limits, now)).toBe(true);
  expect(await chargeBudget(db, "203.0.113.7", growth(1_001), limits, now)).toBe(false);
  expect(await chargeBudget(db, "203.0.113.7", growth(1_000), limits, now)).toBe(true);

  // Another address, the same /56, the next day.
  expect(await chargeBudget(db, "203.0.113.8", creation(400), limits, now)).toBe(true);
  expect(await chargeBudget(db, "2001:db8:abcd:1201::1", creation(600), limits, now)).toBe(true);
  expect(await chargeBudget(db, "2001:db8:abcd:12ff::2", creation(600), limits, now)).toBe(false);
  expect(await chargeBudget(db, "203.0.113.7", creation(400), limits, now + DAY)).toBe(true);
});

test("without an address or limits, nothing is counted", async () => {
  expect(await chargeBudget(db, undefined, creation(5_000), limits)).toBe(true);
  expect(await chargeBudget(db, "not an address", creation(5_000), limits)).toBe(true);
  expect(await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 0, growth: 0 })).toBe(true);
  expect(await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 1, growth: 0 })).toBe(true);
  expect(await chargeBudget(db, "203.0.113.7", creation(5_000), { bytes: 0, creations: 1, growth: 0 })).toBe(false);
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
