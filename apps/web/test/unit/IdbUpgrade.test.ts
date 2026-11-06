import { expect, test } from "vitest";
import { Idb, IdbStore } from "../../app/idb/Idb";

// The database must not have been opened yet (hence a dedicated file).
test("Upgrade from the legacy schema (v2)", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("bailly", 2);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("dictionarySlices");
      request.result.createObjectStore("lastWords");
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
  expect(db.version).toBe(4);
  expect([...db.objectStoreNames].sort()).toEqual(Object.values(IdbStore).sort());
});
