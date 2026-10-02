import { expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import { IdbTags } from "../../app/idb";
import { emptyState, withoutTombstones, type BookmarksState } from "../../app/idb/merge";
import {
  BOOKMARKS_FILE_FORMAT,
  bookmarksFileName,
  exportState,
  parseBookmarksFile,
  toBookmarksFile,
  validateState,
} from "../../app/idb/transfer";

const now = Date.now();
const stamp = (time = now) => formatStamp({ time, counter: 0, node: "a" });
const day = 86_400_000;

const state: BookmarksState = {
  tags: [
    { key: "t1", name: "Homère", description: "", color: "Blue", createdAt: stamp(), pinnedAt: stamp(), updatedAt: stamp(), legacyKey: 3 },
    { key: "t2", name: "Ancienne", description: "", color: "Rose", createdAt: stamp(), updatedAt: stamp(now - 100 * day), deleted: true },
  ],
  tagged: [{ tagKey: "t1", uri: "logos", word: "λόγος", updatedAt: stamp() }],
  starred: [{ uri: "psukhê", word: "ψυχή", updatedAt: stamp(now - 10 * day), deleted: true }],
};

test("an exported file reads back as the existing bookmarks", () => {
  const file = toBookmarksFile(state, { now: new Date(now) });
  expect(file).toMatchObject({ format: BOOKMARKS_FILE_FORMAT, version: 1, exportedAt: new Date(now).toISOString() });
  expect(parseBookmarksFile(JSON.stringify(file))).toEqual(withoutTombstones(exportState(state)));
  expect(file.state.starred).toEqual([]); // No tombstones in an exported file…

  // … but in the synchronized content.
  expect(toBookmarksFile(state, { tombstones: true }).state.starred).toHaveLength(1);
});

test("the export leaves out the former keys and the old tombstones only", () => {
  const exported = exportState(state);
  expect(exported.tags.map(tag => tag.key)).toEqual(["t1"]);
  expect("legacyKey" in exported.tags[0]!).toBe(false);
  expect(exported.starred).toHaveLength(1); // A recent tombstone.
});

test("files that are not exports of the bookmarks are refused", () => {
  expect(() => parseBookmarksFile("not json")).toThrow("n'est pas un export de signets");
  expect(() => parseBookmarksFile(JSON.stringify({ format: "other" }))).toThrow("n'est pas un export de signets");
  expect(() => parseBookmarksFile(JSON.stringify({ format: BOOKMARKS_FILE_FORMAT, version: 2, state: emptyState() }))).toThrow("plus récente");
  expect(() => parseBookmarksFile(JSON.stringify({ format: BOOKMARKS_FILE_FORMAT, version: 1, state: {} }))).toThrow("ne contient pas de signets");
});

test("invalid records are left out, unknown colors replaced", () => {
  const validated = validateState({
    tags: [
      { key: "ok", name: " Platon ", description: 3, color: "Ultraviolet", createdAt: stamp(), updatedAt: stamp() },
      { key: "reserved", name: "favoris", color: "Blue", createdAt: stamp(), updatedAt: stamp() },
      { key: "no-stamp", name: "Sans date", color: "Blue", createdAt: stamp(), updatedAt: "yesterday" },
      { key: "", name: "Sans clé", color: "Blue", createdAt: stamp(), updatedAt: stamp() },
    ],
    tagged: [
      { tagKey: "ok", uri: "logos", word: "λόγος", excerpt: "λόγος parole", updatedAt: stamp() },
      { tagKey: "ok", uri: "psukhe", word: "", excerpt: "ψυχή âme", updatedAt: stamp() }, // No word.
      { tagKey: "ok", uri: "", word: "", excerpt: "", updatedAt: stamp() },
    ],
    starred: [{ uri: "logos", word: "λόγος", excerpt: "", updatedAt: stamp(), deleted: "yes" }, "junk"],
    // The order of the tags of the first previews: ignored.
    tagOrder: { keys: ["ok"], updatedAt: stamp() },
  });

  expect(validated.tags).toEqual([
    { key: "ok", name: "Platon", description: "", color: "Blue", createdAt: stamp(), updatedAt: stamp() },
  ]);
  expect(validated.tagged).toHaveLength(1);
  expect(validated.starred).toEqual([]);
  expect(validated).not.toHaveProperty("tagOrder");
});

test("the stamp of a tag's pinning: kept if valid and not after its latest change, else the tag is not pinned", () => {
  const tag = (key: string, fields: Record<string, unknown>) =>
    ({ key, name: key, description: "", color: "Blue", createdAt: stamp(now - 3 * day), updatedAt: stamp(now - day), ...fields });
  const validated = validateState({
    tags: [
      tag("kept", { pinnedAt: stamp(now - 2 * day) }),
      tag("equal", { pinnedAt: stamp(now - day) }),
      tag("absent", {}),
      tag("invalid", { pinnedAt: "hier" }),
      tag("afterChange", { pinnedAt: stamp(now) }),
      tag("tombstone", { pinnedAt: stamp(now - 2 * day), deleted: true }),
    ],
    tagged: [],
    starred: [],
  }, now);

  const pinnedAt = Object.fromEntries(validated.tags.map(record => [record.key, record.pinnedAt]));
  expect(pinnedAt).toEqual({
    kept: stamp(now - 2 * day),
    equal: stamp(now - day),
    absent: undefined,
    invalid: undefined,
    afterChange: undefined,
    tombstone: undefined,
  });
  expect(validated.tags.filter(record => "pinnedAt" in record).map(record => record.key).sort()).toEqual(["equal", "kept"]);
});

test("file name", () => {
  expect(bookmarksFileName(new Date(2026, 8, 7))).toBe("bailly-signets-2026-09-07.json");
});

test("the words are kept as text, and the excerpts left out (they come from the dictionary)", () => {
  const word = "<img src=x onerror=alert(1)> λόγος";
  const validated = validateState({ tags: [], tagged: [], starred: [{ uri: "logos", word, excerpt: "<b>λόγος</b>", updatedAt: stamp() }] });
  expect(validated.starred).toEqual([{ uri: "logos", word, updatedAt: stamp() }]);
});

test("records stamped too far in the future are left out", () => {
  const future = stamp(now + 2 * day);
  const validated = validateState({
    tags: [{ key: "t", name: "Futur", color: "Blue", createdAt: stamp(), updatedAt: future }],
    tagged: [],
    starred: [
      { uri: "soon", word: "a", excerpt: "a", updatedAt: stamp(now + 60 * 60 * 1000) }, // An hour ahead: clocks drift.
      { uri: "later", word: "b", excerpt: "b", updatedAt: future },
    ],
  }, now);

  expect(validated.tags).toEqual([]);
  expect(validated.starred.map(record => record.uri)).toEqual(["soon"]);
});

test("the stamp of an entry's addition: kept if valid, else its latest change stands for it", () => {
  const validated = validateState({
    tags: [],
    tagged: [],
    starred: [
      { uri: "kept", word: "a", addedAt: stamp(now - 2 * day), updatedAt: stamp(now - day) },
      { uri: "absent", word: "b", updatedAt: stamp(now - day) },
      { uri: "invalid", word: "c", addedAt: "hier", updatedAt: stamp(now - day) },
      { uri: "afterChange", word: "d", addedAt: stamp(now), updatedAt: stamp(now - day) },
      // Equal: `updatedAt` stands for it (the canonical form).
      { uri: "equal", word: "e", addedAt: stamp(now - day), updatedAt: stamp(now - day) },
      // Before, from another device in the same millisecond.
      { uri: "otherNode", word: "f", addedAt: formatStamp({ time: now - day, counter: 0, node: "a" }), updatedAt: formatStamp({ time: now - day, counter: 0, node: "b" }) },
      { uri: "tombstone", word: "", addedAt: stamp(now - 2 * day), updatedAt: stamp(now - day), deleted: true },
    ],
  }, now);

  const addedAt = Object.fromEntries(validated.starred.map(record => [record.uri, record.addedAt]));
  expect(addedAt).toEqual({
    kept: stamp(now - 2 * day),
    absent: undefined,
    invalid: undefined,
    afterChange: undefined,
    equal: undefined,
    otherNode: formatStamp({ time: now - day, counter: 0, node: "a" }),
    tombstone: undefined,
  });
  // An exported file keeps it.
  expect(parseBookmarksFile(JSON.stringify(toBookmarksFile(validated)), now).starred.find(record => record.uri === "kept")?.addedAt).toBe(stamp(now - 2 * day));
});

test("a tombstone may have neither name nor entry", () => {
  const validated = validateState({
    tags: [
      { key: "deleted", name: "", color: "Blue", createdAt: stamp(), updatedAt: stamp(), deleted: true },
      { key: "live", name: "", color: "Blue", createdAt: stamp(), updatedAt: stamp() },
    ],
    tagged: [{ tagKey: "deleted", uri: "logos", word: "", excerpt: "", updatedAt: stamp(), deleted: true }],
    starred: [{ uri: "logos", word: "", excerpt: "", updatedAt: stamp(), deleted: true }],
  });

  expect(validated.tags.map(tag => tag.key)).toEqual(["deleted"]);
  expect(validated.tagged).toHaveLength(1);
  expect(validated.starred).toHaveLength(1);
});

test("a locker has no excerpts; an exported file keeps them, for its reader", () => {
  const state: BookmarksState = { tags: [], tagged: [], starred: [{ uri: "logos", word: "λόγος", updatedAt: stamp() }] };
  const excerpts = new Map([["logos", "λόγος parole"]]);
  expect(toBookmarksFile(state, { tombstones: true }).state.starred[0]).not.toHaveProperty("excerpt");
  expect(toBookmarksFile(state, { excerpts }).state.starred[0]).toMatchObject({ excerpt: "λόγος parole" });
});

test("a description beyond the limit is cut", () => {
  const long = "λόγος ".repeat(100);
  const validated = validateState({
    tags: [{ key: "t", name: "Homère", description: long, color: "Blue", createdAt: stamp(), updatedAt: stamp() }],
    tagged: [],
    starred: [],
  });
  expect(Array.from(validated.tags[0]!.description)).toHaveLength(IdbTags.descriptionMaxLength - 1); // The last space trimmed.
});

test("a name beyond the limit is cut", () => {
  const validated = validateState({
    tags: [{ key: "t", name: "Les Géorgiques de Virgile, livre IV : Aristée, Protée, puis Orphée et Eurydice aux Enfers", color: "Blue", createdAt: stamp(), updatedAt: stamp() }],
    tagged: [],
    starred: [],
  });
  expect(validated.tags[0]!.name).toBe("Les Géorgiques de Virgile, livre IV : Aristée, Protée, puis Orphée et Euryd");
});
