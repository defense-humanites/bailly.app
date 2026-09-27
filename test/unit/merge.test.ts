import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import {
  comparableTagName,
  compact,
  emptyState,
  mergeStates,
  normalize,
  orderTags,
  type BookmarksState,
  type StarredRecord,
  type TaggedRecord,
  type TagRecord,
} from "../../app/idb/merge";

const stamp = (time: number, counter = 0, node = "a") => formatStamp({ time, counter, node });

/**
 * Small pools of keys, URIs and names, so that the generated states share
 * records (and homonymous tags).
 */
const stampArb = fc
  .tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 2 }), fc.constantFrom("a", "b", "c"))
  .map(([time, counter, node]) => stamp(1_000 + time, counter, node));
const tagKeyArb = fc.constantFrom("t1", "t2", "t3", "t4");
const uriArb = fc.constantFrom("logos", "anthropos", "psyche");
const deletedArb = fc.option(fc.constant(true as const), { nil: undefined });

const withoutUndefined = <T extends object>(record: T): T =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;

const tagArb: fc.Arbitrary<TagRecord> = fc
  .record({
    key: tagKeyArb,
    name: fc.constantFrom("Homère", "homere", "Platon", "Sophocle"),
    description: fc.constantFrom("", "notes"),
    color: fc.constantFrom("Blue" as const, "Rose" as const),
    createdAt: stampArb,
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const taggedArb: fc.Arbitrary<TaggedRecord> = fc
  .record({
    tagKey: tagKeyArb,
    uri: uriArb,
    word: fc.constant("λόγος"),
    excerpt: fc.constantFrom("parole", "raison"),
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const starredArb: fc.Arbitrary<StarredRecord> = fc
  .record({
    uri: uriArb,
    word: fc.constant("λόγος"),
    excerpt: fc.constantFrom("parole", "raison"),
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const stateArb: fc.Arbitrary<BookmarksState> = fc.record({
  tags: fc.array(tagArb, { maxLength: 5 }),
  tagged: fc.array(taggedArb, { maxLength: 6 }),
  starred: fc.array(starredArb, { maxLength: 4 }),
  tagOrder: fc.option(
    fc.record({ keys: fc.shuffledSubarray(["t1", "t2", "t3", "t4"]), updatedAt: stampArb }),
    { nil: null },
  ),
});

/**
 * The canonical form of a state (records deduplicated and sorted).
 */
const canonicalState = (state: BookmarksState) => mergeStates(state, emptyState());

describe("mergeStates is a CRDT merge", () => {
  test("commutative", () => {
    fc.assert(fc.property(stateArb, stateArb, (a, b) => {
      expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
    }));
  });

  test("associative", () => {
    fc.assert(fc.property(stateArb, stateArb, stateArb, (a, b, c) => {
      expect(mergeStates(mergeStates(a, b), c)).toEqual(mergeStates(a, mergeStates(b, c)));
    }));
  });

  test("idempotent", () => {
    fc.assert(fc.property(stateArb, stateArb, (a, b) => {
      const merged = mergeStates(a, b);
      expect(mergeStates(merged, merged)).toEqual(merged);
      expect(mergeStates(merged, b)).toEqual(merged);
    }));
  });
});

describe("normalize", () => {
  test("idempotent, and leaves no homonymous tags", () => {
    fc.assert(fc.property(stateArb, (a) => {
      const normalized = normalize(canonicalState(a));
      expect(normalize(normalized)).toEqual(normalized);

      const names = normalized.tags.filter(tag => !tag.deleted).map(tag => comparableTagName(tag.name));
      expect(new Set(names).size).toBe(names.length);
    }));
  });

  test("devices synchronizing through a server converge", () => {
    fc.assert(fc.property(
      fc.array(stateArb, { minLength: 2, maxLength: 4 }),
      fc.array(fc.nat(), { maxLength: 8 }),
      (devices, schedule) => {
        let server = emptyState();
        const sync = (i: number) => {
          devices[i] = normalize(mergeStates(devices[i]!, server));
          server = devices[i];
        };

        // Some synchronizations in any order, then two full rounds.
        for (const n of schedule) sync(n % devices.length);
        for (let round = 0; round < 2; round++) {
          devices.forEach((_, i) => {
            sync(i);
          });
        }

        for (const device of devices) expect(device).toEqual(server);
      },
    ));
  });

  test("fuses homonymous tags into the first created one", () => {
    const state: BookmarksState = {
      tags: [
        { key: "t2", name: "homere", description: "", color: "Rose", createdAt: stamp(2), updatedAt: stamp(5) },
        { key: "t1", name: "Homère", description: "", color: "Blue", createdAt: stamp(1), updatedAt: stamp(1) },
      ],
      tagged: [
        { tagKey: "t2", uri: "logos", word: "λόγος", excerpt: "", updatedAt: stamp(3) },
        { tagKey: "t1", uri: "psyche", word: "ψυχή", excerpt: "", updatedAt: stamp(4) },
      ],
      starred: [],
      tagOrder: null,
    };

    const normalized = normalize(canonicalState(state));
    expect(normalized.tags).toEqual([
      expect.objectContaining({ key: "t1", name: "Homère" }),
      expect.objectContaining({ key: "t2", deleted: true, updatedAt: stamp(5) }),
    ]);
    const live = normalized.tagged.filter(record => !record.deleted);
    expect(live.map(record => [record.tagKey, record.uri])).toEqual([["t1", "logos"], ["t1", "psyche"]]);
  });
});

test("the latest version of a record wins; at the same stamp, the deletion", () => {
  const star = (updatedAt: string, deleted?: true): StarredRecord =>
    withoutUndefined({ uri: "logos", word: "λόγος", excerpt: "", updatedAt, deleted });
  const state = (starred: StarredRecord[]): BookmarksState => ({ ...emptyState(), starred });

  expect(mergeStates(state([star(stamp(1))]), state([star(stamp(2), true)])).starred).toEqual([star(stamp(2), true)]);
  expect(mergeStates(state([star(stamp(3))]), state([star(stamp(2), true)])).starred).toEqual([star(stamp(3))]);
  expect(mergeStates(state([star(stamp(2))]), state([star(stamp(2), true)])).starred).toEqual([star(stamp(2), true)]);
});

test("orderTags: the unlisted tags first (latest created first), then the order", () => {
  const tag = (key: string, time: number) => ({ key, createdAt: stamp(time) });
  const tags = [tag("a", 1), tag("b", 2), tag("c", 3), tag("d", 4)];
  expect(orderTags(tags, null).map(t => t.key)).toEqual(["d", "c", "b", "a"]);
  expect(orderTags(tags, { keys: ["a", "gone", "b"], updatedAt: stamp(5) }).map(t => t.key)).toEqual(["d", "c", "a", "b"]);
});

test("compact removes the old tombstones only", () => {
  const day = 86_400_000;
  const state: BookmarksState = {
    ...emptyState(),
    starred: [
      { uri: "old", word: "", excerpt: "", updatedAt: stamp(0), deleted: true },
      { uri: "recent", word: "", excerpt: "", updatedAt: stamp(80 * day), deleted: true },
      { uri: "live", word: "", excerpt: "", updatedAt: stamp(0) },
    ],
  };
  expect(compact(state, 90 * day, 1_000 + 100 * day).starred.map(record => record.uri)).toEqual(["recent", "live"]);
});
