import { expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
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
    { key: "t1", name: "Homère", description: "", color: "Blue", createdAt: stamp(), updatedAt: stamp(), legacyKey: 3 },
    { key: "t2", name: "Ancienne", description: "", color: "Rose", createdAt: stamp(), updatedAt: stamp(now - 100 * day), deleted: true },
  ],
  tagged: [{ tagKey: "t1", uri: "logos", word: "λόγος", excerpt: "λόγος parole", updatedAt: stamp() }],
  starred: [{ uri: "psukhê", word: "ψυχή", excerpt: "ψυχή âme", updatedAt: stamp(now - 10 * day), deleted: true }],
  tagOrder: { keys: ["t1"], updatedAt: stamp() },
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
      { tagKey: "ok", uri: "psukhe", word: "ψυχή", excerpt: "", updatedAt: stamp() }, // No excerpt.
      { tagKey: "ok", uri: "", word: "", excerpt: "", updatedAt: stamp() },
    ],
    starred: [{ uri: "logos", word: "λόγος", excerpt: "", updatedAt: stamp(), deleted: "yes" }, "junk"],
    tagOrder: { keys: ["ok", "ok", 3], updatedAt: stamp() },
  });

  expect(validated.tags).toEqual([
    { key: "ok", name: "Platon", description: "", color: "Blue", createdAt: stamp(), updatedAt: stamp() },
  ]);
  expect(validated.tagged).toHaveLength(1);
  expect(validated.starred).toEqual([]);
  expect(validated.tagOrder).toEqual({ keys: ["ok"], updatedAt: stamp() });
});

test("file name", () => {
  expect(bookmarksFileName(new Date(2026, 8, 7))).toBe("bailly-signets-2026-09-07.json");
});

test("entries are kept as text (the excerpt is never rendered as HTML)", () => {
  const excerpt = "<img src=x onerror=alert(1)> λόγος";
  const validated = validateState({ tags: [], tagged: [], starred: [{ uri: "logos", word: "λόγος", excerpt, updatedAt: stamp() }] });
  expect(validated.starred[0]?.excerpt).toBe(excerpt);
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
    tagOrder: { keys: ["t"], updatedAt: future },
  }, now);

  expect(validated.tags).toEqual([]);
  expect(validated.starred.map(record => record.uri)).toEqual(["soon"]);
  expect(validated.tagOrder).toBeNull();
});
