import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import {
  comparableTagName,
  compact,
  emptyState,
  entryTombstone,
  fitImport,
  limitExcesses,
  mergeStates,
  normalize,
  joinRecords,
  latestAddedFirst,
  orderTags,
  restoreRecords,
  tagTombstone,
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
    pinnedAt: fc.option(stampArb, { nil: undefined }),
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const taggedArb: fc.Arbitrary<TaggedRecord> = fc
  .record({
    tagKey: tagKeyArb,
    uri: uriArb,
    word: fc.constant("λόγος"),
    addedAt: fc.option(stampArb, { nil: undefined }),
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const starredArb: fc.Arbitrary<StarredRecord> = fc
  .record({
    uri: uriArb,
    word: fc.constant("λόγος"),
    addedAt: fc.option(stampArb, { nil: undefined }),
    updatedAt: stampArb,
    deleted: deletedArb,
  })
  .map(withoutUndefined);

const stateArb: fc.Arbitrary<BookmarksState> = fc.record({
  tags: fc.array(tagArb, { maxLength: 5 }),
  tagged: fc.array(taggedArb, { maxLength: 6 }),
  starred: fc.array(starredArb, { maxLength: 4 }),
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
        { tagKey: "t2", uri: "logos", word: "λόγος", addedAt: stamp(2), updatedAt: stamp(3) },
        { tagKey: "t1", uri: "psyche", word: "ψυχή", updatedAt: stamp(4) },
      ],
      starred: [],
    };

    const normalized = normalize(canonicalState(state));
    expect(normalized.tags).toEqual([
      expect.objectContaining({ key: "t1", name: "Homère" }),
      expect.objectContaining({ key: "t2", deleted: true, updatedAt: stamp(5) }),
    ]);
    const live = normalized.tagged.filter(record => !record.deleted);
    expect(live.map(record => [record.tagKey, record.uri])).toEqual([["t1", "logos"], ["t1", "psyche"]]);
    // A moved entry keeps its addition.
    expect(live[0]!.addedAt).toBe(stamp(2));
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

test("orderTags: the pinned tags first, in the order of their pinning, then the others by name", () => {
  const tag = (key: string, name: string, pinned?: number) =>
    withoutUndefined({ key, name, pinnedAt: pinned === undefined ? undefined : stamp(pinned) });
  const tags = [
    tag("a", "Sophocle"),
    tag("b", "Œdipe"),
    tag("c", "Platon", 5),
    tag("d", "Élégie"),
    tag("e", "homère"),
    tag("f", "Aristote", 2),
    tag("g", "Livre 10"),
    tag("h", "Livre 9"),
  ];
  // French collation: case and diacritics ignored, numbers by value.
  expect(orderTags(tags).map(t => t.name)).toEqual(
    ["Aristote", "Platon", "Élégie", "homère", "Livre 9", "Livre 10", "Œdipe", "Sophocle"],
  );
});

test("pinning and unpinning a tag are changes of its record, merged as a whole", () => {
  const tag = (updatedAt: string, pinnedAt?: string): TagRecord =>
    withoutUndefined({ key: "t1", name: "Homère", description: "", color: "Blue", createdAt: stamp(1), pinnedAt, updatedAt });
  const state = (tags: TagRecord[]): BookmarksState => ({ ...emptyState(), tags });

  // Pinned on a device, renamed earlier on another: the pinning wins.
  expect(mergeStates(state([tag(stamp(3), stamp(3))]), state([{ ...tag(stamp(2)), name: "Iliade" }])).tags).toEqual([tag(stamp(3), stamp(3))]);
  // Unpinned later: the tag is not pinned anymore.
  expect(mergeStates(state([tag(stamp(3), stamp(3))]), state([tag(stamp(4))])).tags).toEqual([tag(stamp(4))]);
  // A tombstone does not keep the pinning.
  expect(tagTombstone(tag(stamp(3), stamp(3)), stamp(5))).not.toHaveProperty("pinnedAt");
  // A tag brought back (a file, a key joined again) keeps it.
  const local = state([tagTombstone(tag(stamp(3), stamp(3)), stamp(5))]);
  expect(restoreRecords(local, state([tag(stamp(3), stamp(3))]), stamp(20)).tags).toEqual([tag(stamp(20), stamp(3))]);
  expect(joinRecords(local, state([tag(stamp(3), stamp(3))]), stamp(20)).tags).toEqual([tag(stamp(20), stamp(3))]);
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
    // Restored, after its deletion; its addition kept (without `addedAt`,
    // its former `updatedAt`).
    { ...entry("deleted", 20), addedAt: stamp(2) },
    entry("changed", 3), // As is: the later local version wins the merge.
    { ...entry("missing", 20), addedAt: stamp(2) },
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
  // Brought back, not added again.
  expect(merged.starred.find(record => record.uri === "deletedHere")?.addedAt).toBe(stamp(3));
});

test("an import restores the entries in their order of addition, among the local ones", () => {
  const entry = (uri: string, added: number, updated = added): StarredRecord =>
    ({ uri, word: uri, addedAt: stamp(added), updatedAt: stamp(updated) });
  // On this device: one entry, added between those of the file.
  const local: BookmarksState = { ...emptyState(), starred: [entry("here", 5)] };
  const imported: BookmarksState = {
    ...emptyState(),
    starred: [entry("first", 1), entry("last", 9), entry("changed", 3, 7)],
  };

  const merged = mergeStates(local, restoreRecords(local, imported, stamp(20)));
  const shown = [...merged.starred].sort(latestAddedFirst).map(record => record.uri);
  expect(shown).toEqual(["last", "here", "changed", "first"]);
  // All restored as changes made now (they supersede deletions elsewhere).
  expect(merged.starred.filter(record => record.uri !== "here").every(record => record.updatedAt === stamp(20))).toBe(true);
});

test("joinRecords and restoreRecords keep the addition of the entries brought back (tags and favorites alike)", () => {
  const tagged = (added: number | undefined, updated: number, deleted?: true): TaggedRecord =>
    withoutUndefined({ tagKey: "t1", uri: "logos", word: deleted ? "" : "λόγος", addedAt: added === undefined ? undefined : stamp(added), updatedAt: stamp(updated), deleted });
  const local: BookmarksState = { ...emptyState(), tagged: [tagged(undefined, 8, true)] };
  const remote: BookmarksState = { ...emptyState(), tagged: [tagged(2, 6)] };

  expect(joinRecords(local, remote, stamp(20)).tagged).toEqual([tagged(2, 20)]);
  expect(restoreRecords(local, remote, stamp(20)).tagged).toEqual([tagged(2, 20)]);
  // An addition that does not precede the change (not expected: the stamp
  // follows the state brought back) is taken as made then: none kept.
  expect(restoreRecords(local, { ...emptyState(), tagged: [tagged(30, 30)] }, stamp(20)).tagged).toEqual([tagged(undefined, 20)]);
});

test("a tombstone keeps neither the word nor the addition", () => {
  const record: StarredRecord = { uri: "logos", word: "λόγος", addedAt: stamp(1), updatedAt: stamp(3) };
  expect(entryTombstone(record, stamp(5))).toEqual({ uri: "logos", word: "", updatedAt: stamp(5), deleted: true });
});

test("latestAddedFirst: by the addition, else by the latest change", () => {
  const records: StarredRecord[] = [
    { uri: "a", word: "a", addedAt: stamp(1), updatedAt: stamp(10) },
    { uri: "b", word: "b", updatedAt: stamp(5) },
    { uri: "c", word: "c", addedAt: stamp(8), updatedAt: stamp(8) },
  ];
  expect([...records].sort(latestAddedFirst).map(record => record.uri)).toEqual(["c", "b", "a"]);
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
  };
  expect(limitExcesses(within, limits)).toEqual([]);

  const beyond: BookmarksState = {
    ...within,
    tags: [...within.tags, tag("d", "Sophocle")],
    tagged: [...within.tagged, entry("a", "w")],
    starred: [...within.starred, star("z")],
  };
  // Without the incoming state: everything is this device's own.
  expect(limitExcesses(beyond, limits)).toEqual([
    { kind: "tags", count: 3, local: ["Homère", "Platon", "Sophocle"] },
    { kind: "entries", tag: "Homère", count: 3, local: ["x", "y", "w"] },
    { kind: "entries", tag: null, count: 3, local: ["x", "y", "z"] },
  ]);

  // With it (the locker): only what this device brings, the homonyms of the
  // locker's tags counting as the same tag.
  const incoming: BookmarksState = {
    tags: [tag("h", "homere"), tag("b", "Platon")],
    tagged: [entry("h", "x"), entry("b", "p")],
    starred: [star("x"), star("y")],
  };
  expect(limitExcesses(beyond, limits, incoming)).toEqual([
    { kind: "tags", count: 3, local: ["Sophocle"] },
    { kind: "entries", tag: "Homère", count: 3, local: ["y", "w"] },
    { kind: "entries", tag: null, count: 3, local: ["z"] },
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
  };
  const imported: BookmarksState = {
    // "homere" is fused with "Homère"; one tag only has room ("Eschyle", created first).
    tags: [tag("h", "homere", 5), tag("e", "Eschyle", 3), tag("s", "Sophocle", 4)],
    tagged: [entry("h", "y", 1), entry("h", "v", 13), entry("h", "u", 12), entry("e", "p", 1), entry("s", "q", 1)],
    starred: [star("s1", 1), star("s4", 24), star("s3", 23)],
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

test("fitImport: among the new entries, those added first are imported (by their addition, not their latest change)", () => {
  const entry = (uri: string, added: number, updated: number): StarredRecord =>
    ({ uri, word: uri, addedAt: stamp(added), updatedAt: stamp(updated) });
  const imported: BookmarksState = {
    ...emptyState(),
    starred: [entry("recent", 9, 9), entry("old", 1, 12)],
  };
  const { state, skipped } = fitImport(emptyState(), imported, { maxTags: 10, tagMaxItems: 1 });
  expect(state.starred.map(record => record.uri)).toEqual(["old"]);
  expect(skipped).toEqual({ tags: 0, entries: 1 });
});
