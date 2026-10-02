import { expect, test } from "vitest";
import { Idb, IdbBookmarks, IdbHistory, IdbStarred, IdbTaggedEntry, IdbTags } from "../../app/idb";
import { IdbMetaKey, IdbStore } from "../../app/idb/Idb";
import { isStamp } from "../../app/idb/clock";

/**
 * Creates a version 3 database (numeric keys, positions, no stamps), as the
 * application stored it before the migration.
 */
function createV3Database(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("bailly", 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      const history = db.createObjectStore("history", { autoIncrement: true });
      history.createIndex("uri", "uri");
      const starred = db.createObjectStore("starred", { autoIncrement: true });
      starred.createIndex("uri", "uri");
      const tagged = db.createObjectStore("tagged", { autoIncrement: true });
      tagged.createIndex("uri", "uri");
      tagged.createIndex("tagKey", "tagKey");
      tagged.createIndex("tagKey+uri", ["tagKey", "uri"], { unique: true });
      const tags = db.createObjectStore("tags", { autoIncrement: true });
      tags.createIndex("name", "name");
      tags.createIndex("color", "color");
      tags.createIndex("position", "position");
      tags.createIndex("position+color", ["position", "color"]);

      // Keys 1 and 2; the second created tag was arranged first (an order not
      // kept: the tags are not arranged by hand anymore).
      tags.add({ name: "Banquet", description: "De l'amour", color: "Rose", position: 2 });
      // A color unknown to the current version (e.g. removed since).
      tags.add({ name: "Théétète", description: "", color: "Mauve", position: 1 });
      tagged.add({ tagKey: 1, word: "ἔρως", uri: "erôs", excerpt: "ἔρως amour" });
      tagged.add({ tagKey: 2, word: "ἐπιστήμη", uri: "epistêmê", excerpt: "ἐπιστήμη science" });
      tagged.add({ tagKey: 9, word: "orphelin", uri: "orphan", excerpt: "sans étiquette" });
      starred.add({ word: "λόγος", uri: "logos", excerpt: "λόγος parole" });
      history.add({ word: "ψυχή", uri: "psukhê", excerpt: "ψυχή âme" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("open failed"));
    };
  });
}

// The database must not have been opened yet (hence a dedicated file).
test("Upgrade from version 3: UUIDs, stamps and legacy keys", async () => {
  await createV3Database();
  Idb.configure();

  const db = await Idb.getIndexedDB();
  expect(db.version).toBe(4);
  expect([...db.objectStoreNames].sort()).toEqual(Object.values(IdbStore).sort());

  const tags = await IdbTags.getAll();
  // By name: none is pinned.
  expect(tags.map(tag => [tag.name, tag.legacyKey, tag.pinnedAt])).toEqual([["Banquet", 1, undefined], ["Théétète", 2, undefined]]);
  expect(tags[0]).toMatchObject({ description: "De l'amour", color: "Rose" });
  expect(tags[1]!.color).toBe(IdbTags.colorKeys[0]);
  for (const tag of tags) expect(tag.key).toMatch(/^[0-9a-f-]{36}$/);

  const [banquet, theetete] = tags;
  expect((await IdbTaggedEntry.getAll()).map(entry => [entry.tagKey, entry.uri]).sort()).toEqual(
    [[banquet!.key, "erôs"], [theetete!.key, "epistêmê"]].sort(),
  );
  expect(await IdbStarred.getAll()).toEqual([{ word: "λόγος", uri: "logos", excerpt: "λόγος parole" }]);
  // The excerpts are kept apart from the bookmarks (not synchronized).
  expect((await IdbBookmarks.getState()).starred).toEqual([{ word: "λόγος", uri: "logos", updatedAt: expect.any(String) as string }]);
  expect(await db.get(IdbStore.Excerpts, "erôs")).toEqual({ uri: "erôs", excerpt: "ἔρως amour" });
  expect(await IdbHistory.get()).toEqual([{ word: "ψυχή", uri: "psukhê", excerpt: "ψυχή âme" }]);

  // Everything is stamped, and the clock and the device id are set.
  const state = await IdbBookmarks.getState();
  for (const record of [...state.tags, ...state.tagged, ...state.starred]) expect(isStamp(record.updatedAt)).toBe(true);
  expect(isStamp(await db.get(IdbStore.Meta, IdbMetaKey.Clock))).toBe(true);
  expect(await db.get(IdbStore.Meta, IdbMetaKey.Node)).toMatch(/^[0-9a-f]{8}$/);

  // New changes still work, and are stamped after the migrated records.
  const created = await IdbTags.add({ name: "Timée" });
  expect(created.state).toBe("success");
  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual(["Banquet", "Théétète", "Timée"]);
});
