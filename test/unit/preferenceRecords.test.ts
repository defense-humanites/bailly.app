import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import {
  applicableValue,
  MAX_PREFERENCE_RECORDS,
  mergePreferenceRecords,
  preferenceRecords,
  validatePreferenceRecords,
  type PreferenceRecord,
} from "../../app/idb/preferenceRecords";
import { IdbPreferences } from "../../app/idb";
import { Idb, IdbMetaKey } from "../../app/idb/Idb";

const now = Date.now();
const stampArb = fc
  .tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 2 }), fc.constantFrom("a", "b", "c"))
  .map(([time, counter, node]) => formatStamp({ time: now - 1_000 + time, counter, node }));

const recordArb: fc.Arbitrary<PreferenceRecord> = fc.record({
  key: fc.constantFrom("readingFont", "transliterateGreek", "inputMode", "laterPreference"),
  value: fc.oneof(fc.boolean(), fc.constantFrom("book", "bodoni", "betaCode"), fc.integer({ min: 0, max: 3 })),
  updatedAt: stampArb,
});
const recordsArb = fc.array(recordArb, { maxLength: 8 });

describe("merging the preferences is a CRDT", () => {
  test("commutative", () => {
    fc.assert(fc.property(recordsArb, recordsArb, (a, b) => {
      expect(mergePreferenceRecords(a, b)).toEqual(mergePreferenceRecords(b, a));
    }));
  });

  test("associative", () => {
    fc.assert(fc.property(recordsArb, recordsArb, recordsArb, (a, b, c) => {
      expect(mergePreferenceRecords(mergePreferenceRecords(a, b), c)).toEqual(mergePreferenceRecords(a, mergePreferenceRecords(b, c)));
    }));
  });

  test("idempotent", () => {
    fc.assert(fc.property(recordsArb, (a) => {
      const merged = mergePreferenceRecords(a);
      expect(mergePreferenceRecords(merged, merged)).toEqual(merged);
    }));
  });
});

test("each preference keeps its latest change, independently of the others", () => {
  const stamp = (t: number) => formatStamp({ time: now + t, counter: 0, node: "a" });
  const laptop: PreferenceRecord[] = [
    { key: "readingFont", value: "bodoni", updatedAt: stamp(2) },
    { key: "transliterateGreek", value: false, updatedAt: stamp(1) },
  ];
  const phone: PreferenceRecord[] = [
    { key: "readingFont", value: "book", updatedAt: stamp(1) },
    { key: "transliterateGreek", value: true, updatedAt: stamp(3) },
  ];
  expect(mergePreferenceRecords(laptop, phone)).toEqual([
    { key: "readingFont", value: "bodoni", updatedAt: stamp(2) },
    { key: "transliterateGreek", value: true, updatedAt: stamp(3) },
  ]);
});

test("the records received are validated and bounded, the known preferences always kept", () => {
  const stamp = (t: number) => formatStamp({ time: now + t, counter: 0, node: "a" });
  expect(validatePreferenceRecords("garbage")).toEqual([]);
  expect(validatePreferenceRecords([
    { key: "readingFont", value: "book", updatedAt: stamp(0), extra: 1 },
    { key: "", value: true, updatedAt: stamp(0) },
    { key: "x".repeat(65), value: true, updatedAt: stamp(0) },
    { key: "a", value: { nested: true }, updatedAt: stamp(0) },
    { key: "b", value: "x".repeat(101), updatedAt: stamp(0) },
    { key: "c", value: Number.NaN, updatedAt: stamp(0) },
    { key: "d", value: true, updatedAt: "not a stamp" },
    { key: "e", value: true, updatedAt: stamp(2 * 24 * 60 * 60 * 1000) }, // Too far in the future.
  ], now)).toEqual([{ key: "readingFont", value: "book", updatedAt: stamp(0) }]);

  const unknown = Array.from({ length: 2 * MAX_PREFERENCE_RECORDS }, (_, i) => ({ key: `later${String(i).padStart(3, "0")}`, value: i, updatedAt: stamp(i) }));
  const kept = validatePreferenceRecords([{ key: "inputMode", value: "betaCode", updatedAt: stamp(-5) }, ...unknown], now);
  expect(kept).toHaveLength(MAX_PREFERENCE_RECORDS);
  expect(kept.some(record => record.key === "inputMode")).toBe(true);
  // The most recent unknown ones.
  expect(kept.filter(record => record.key.startsWith("later")).map(record => record.value as number).sort((a, b) => a - b)[0])
    .toBe(2 * MAX_PREFERENCE_RECORDS - (MAX_PREFERENCE_RECORDS - 1));
});

test("invalid entries cannot push the known preferences out", () => {
  const stamp = formatStamp({ time: now, counter: 0, node: "a" });
  const junk = Array.from({ length: 1_000 }, () => ({ key: "", value: true, updatedAt: stamp }));
  expect(validatePreferenceRecords([...junk, { key: "readingFont", value: "book", updatedAt: stamp }], now))
    .toEqual([{ key: "readingFont", value: "book", updatedAt: stamp }]);
});

test("a value this version cannot apply is not applied", () => {
  const stamp = formatStamp({ time: now, counter: 0, node: "a" });
  expect(applicableValue({ key: "readingFont", value: "book", updatedAt: stamp })).toBe("book");
  expect(applicableValue({ key: "readingFont", value: "a-font-added-since", updatedAt: stamp })).toBeUndefined();
  expect(applicableValue({ key: "transliterateGreek", value: "yes", updatedAt: stamp })).toBeUndefined();
});

test("only the synchronizable preferences are stamped", () => {
  const stamp = formatStamp({ time: now, counter: 0, node: "a" });
  expect(preferenceRecords({ readingFont: "book", readingSize: "large", transliterateGreek: true }, stamp)).toEqual([
    { key: "readingFont", value: "book", updatedAt: stamp },
    { key: "transliterateGreek", value: true, updatedAt: stamp },
  ]);
});

test("IndexedDB: the changes are stamped, and the merges move the clock on", async () => {
  expect(await IdbPreferences.getRecords()).toEqual([]);
  const [first] = await IdbPreferences.record({ readingFont: "bodoni", readingSize: "large" });
  expect(first).toMatchObject({ key: "readingFont", value: "bodoni" });
  const [second] = await IdbPreferences.record({ readingFont: "book" });
  expect(second!.updatedAt > first!.updatedAt).toBe(true);
  expect(await IdbPreferences.getRecords()).toEqual([second]);

  // A later change from another device wins, and the clock follows it.
  const later = formatStamp({ time: Date.now() + 60_000, counter: 0, node: "zz" });
  const merged = await IdbPreferences.merge([{ key: "readingFont", value: "didot", updatedAt: later }, { key: "inflectedForms", value: false, updatedAt: later }]);
  expect(merged.map(record => record.value)).toEqual([false, "didot"]);
  expect(await Idb.readMeta(IdbMetaKey.Clock)).toBe(later);
  const [next] = await IdbPreferences.record({ readingFont: "bodoni" });
  expect(next!.updatedAt > later).toBe(true);
});
