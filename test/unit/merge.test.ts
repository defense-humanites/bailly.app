import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import {
  comparableTagName,
  compact,
  emptyState,
  fitImport,
  limitExcesses,
  mergeStates,
  normalize,
  joinRecords,
  orderTags,
  restoreRecords,
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
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const starredArb: fc.Arbitrary<StarredRecord> = fc
  .record({
    uri: uriArb,
    word: fc.constant("λόγος"),
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

  test("the locker keeps within the limits: a merge beyond them is not applied", () => {
    const limits = { maxTags: 2, tagMaxItems: 1 };
    fc.assert(fc.property(
      fc.array(stateArb, { minLength: 2, maxLength: 4 }),
      fc.array(fc.nat(), { maxLength: 12 }),
      (devices, schedule) => {
        let server = emptyState();
        for (const n of schedule) {
          const i = n % devices.length;
          const merged = normalize(mergeStates(devices[i]!, server));
          if (limitExcesses(merged, limits).length) continue; // The user makes room first.
          devices[i] = merged;
          server = merged;
          expect(limitExcesses(server, limits)).toEqual([]);
        }
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
        { tagKey: "t2", uri: "logos", word: "λόγος", updatedAt: stamp(3) },
        { tagKey: "t1", uri: "psyche", word: "ψυχή", updatedAt: stamp(4) },
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
    withoutUndefined({ uri: "logos", word: "λόγος", updatedAt, deleted });
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
      { uri: "old", word: "", updatedAt: stamp(0), deleted: true },
      { uri: "recent", word: "", updatedAt: stamp(80 * day), deleted: true },
      { uri: "live", word: "", updatedAt: stamp(0) },
    ],
  };
  expect(compact(state, 90 * day, 1_000 + 100 * day).starred.map(record => record.uri)).toEqual(["recent", "live"]);
});

test("restoreRecords: what is missing or deleted comes back, later changes stay, nothing is deleted", () => {
  const entry = (uri: string, time: number, deleted?: true): StarredRecord =>
    withoutUndefined({ uri, word: uri, updatedAt: stamp(time), deleted });
  const local: BookmarksState = {
    ...emptyState(),
    starred: [entry("deleted", 5, true), entry("changed", 9), entry("kept", 1)],
  };
  const imported: BookmarksState = {
    ...emptyState(),
    starred: [entry("deleted", 2), entry("changed", 3), entry("missing", 2), entry("kept", 8, true)],
  };

  const restored = restoreRecords(local, imported, stamp(20));
  expect(restored.starred).toEqual([
    entry("deleted", 20), // Restored, after its deletion.
    entry("changed", 3), // As is: the later local version wins the merge.
    entry("missing", 20),
  ]);

  const merged = mergeStates(local, restored);
  expect(merged.starred.filter(record => !record.deleted).map(record => record.uri)).toEqual(["changed", "deleted", "kept", "missing"]);
  expect(merged.starred.find(record => record.uri === "changed")?.updatedAt).toBe(stamp(9));
});

test("joinRecords: what exists online is not deleted by the joining device, online deletions apply", () => {
  const entry = (uri: string, time: number, deleted?: true): StarredRecord =>
    withoutUndefined({ uri, word: uri, updatedAt: stamp(time), deleted });
  const local: BookmarksState = {
    ...emptyState(),
    starred: [entry("deletedHere", 8, true), entry("deletedOnline", 2), entry("addedHere", 9)],
  };
  const remote: BookmarksState = {
    ...emptyState(),
    starred: [entry("deletedHere", 3), entry("deletedOnline", 7, true), entry("online", 4)],
  };

  const merged = mergeStates(local, joinRecords(local, remote, stamp(20)));
  expect(merged.starred.filter(record => !record.deleted).map(record => record.uri)).toEqual(["addedHere", "deletedHere", "online"]);
  expect(merged.starred.find(record => record.uri === "deletedHere")?.updatedAt).toBe(stamp(20));
});

test("limitExcesses: the tags, the entries of each tag, and the favorites", () => {
  const tag = (key: string, name: string, deleted?: true): TagRecord =>
    ({ key, name, description: "", color: "Blue", createdAt: stamp(1), updatedAt: stamp(1), ...(deleted ? { deleted } : {}) });
  const entry = (tagKey: string, uri: string, deleted?: true): TaggedRecord =>
    ({ tagKey, uri, word: uri, updatedAt: stamp(2), ...(deleted ? { deleted } : {}) });
  const star = (uri: string): StarredRecord => ({ uri, word: uri, updatedAt: stamp(3) });
  const limits = { maxTags: 2, tagMaxItems: 2 };

  const within: BookmarksState = {
    tags: [tag("a", "Homère"), tag("b", "Platon"), tag("c", "Ancienne", true)],
    tagged: [entry("a", "x"), entry("a", "y"), entry("a", "z", true), entry("c", "x"), entry("c", "y"), entry("c", "z")],
    starred: [star("x"), star("y")],
    tagOrder: null,
  };
  expect(limitExcesses(within, limits)).toEqual([]);

  const beyond: BookmarksState = {
    ...within,
    tags: [...within.tags, tag("d", "Sophocle")],
    tagged: [...within.tagged, entry("a", "w")],
    starred: [...within.starred, star("z")],
  };
  expect(limitExcesses(beyond, limits)).toEqual([
    { kind: "tags", count: 3 },
    { kind: "entries", tag: "Homère", count: 3 },
    { kind: "entries", tag: null, count: 3 },
  ]);
});

test("fitImport: the local bookmarks stay, the new ones added first are imported, within the limits", () => {
  const tag = (key: string, name: string, created: number): TagRecord =>
    ({ key, name, description: "", color: "Blue", createdAt: stamp(created), updatedAt: stamp(created) });
  const entry = (tagKey: string, uri: string, added: number): TaggedRecord =>
    ({ tagKey, uri, word: uri, updatedAt: stamp(added) });
  const star = (uri: string, added: number): StarredRecord => ({ uri, word: uri, updatedAt: stamp(added) });
  const limits = { maxTags: 3, tagMaxItems: 3 };

  const local: BookmarksState = {
    tags: [tag("a", "Homère", 1), tag("b", "Platon", 2)],
    tagged: [entry("a", "x", 10), entry("a", "y", 11)],
    starred: [star("s1", 20), star("s2", 21)],
    tagOrder: null,
  };
  const imported: BookmarksState = {
    // "homere" is fused with "Homère"; one tag only has room ("Eschyle", created first).
    tags: [tag("h", "homere", 5), tag("e", "Eschyle", 3), tag("s", "Sophocle", 4)],
    tagged: [entry("h", "y", 1), entry("h", "v", 13), entry("h", "u", 12), entry("e", "p", 1), entry("s", "q", 1)],
    starred: [star("s1", 1), star("s4", 24), star("s3", 23)],
    tagOrder: null,
  };

  const { state, skipped } = fitImport(local, imported, limits);
  expect(state.tags.map(t => t.key)).toEqual(["h", "e"]);
  // Homère: x, y here, room for one more: u (added before v).
  expect(state.tagged.map(r => `${r.tagKey}:${r.uri}`)).toEqual(["h:y", "h:u", "e:p"]);
  expect(state.starred.map(r => r.uri)).toEqual(["s1", "s3"]);
  expect(skipped).toEqual({ tags: 1, entries: 3 }); // Sophocle; v, q, s4.

  // Restored, then merged: within the limits.
  const merged = normalize(mergeStates(local, restoreRecords(local, state, stamp(100))));
  expect(limitExcesses(merged, limits)).toEqual([]);
});
