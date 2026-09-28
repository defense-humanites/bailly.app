import { expect, test } from "vitest";
import { Idb, IdbStore } from "../../app/idb/Idb";

// The database must not have been opened yet (hence a dedicated file).
test("Upgrade from a first version 4 without the excerpts store (preview devices)", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("bailly", 4);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(IdbStore.History, { autoIncrement: true }).createIndex("uri", "uri");
      db.createObjectStore(IdbStore.Starred, { keyPath: "uri" });
      const tagged = db.createObjectStore(IdbStore.Tagged, { keyPath: ["tagKey", "uri"] });
      tagged.createIndex("uri", "uri");
      tagged.createIndex("tagKey", "tagKey");
      db.createObjectStore(IdbStore.Tags, { keyPath: "key" });
      db.createObjectStore(IdbStore.Meta);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("open failed"));
    };
  });

  const db = await Idb.getIndexedDB();
  expect(db.version).toBe(5);
  expect([...db.objectStoreNames].sort()).toEqual(Object.values(IdbStore).sort());
});
