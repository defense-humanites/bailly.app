import {
  attempt,
  Idb,
  IdbStore,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
} from "./Idb";

/**
 * A collection of methods for managing the history of viewed entries.
 */
export class IdbHistory {
  /**
   * Adds an entry to the history (or moves it to the top if it is already
   * there), then removes the entries that exceed the history length setting
   * (cf. `Idb.config`).
   * @param entry A given entry to convert into an `IdbEntry`.
   * @returns The inserted entry.
   */
  static async add(entry: IdbEntryCreation): Promise<IdbResult<IdbEntry>> {
    return attempt(async () => {
      const data: IdbEntry = Idb.buildIdbEntry(entry);

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.History, "readwrite");

      const key = await tx.store.index("uri").getKey(data.uri);
      if (key !== undefined) await tx.store.delete(key);

      await tx.store.add(data);

      // Remove the oldest entries.
      let count = await tx.store.count();
      for await (const cursor of tx.store) {
        if (count <= Idb.config.searchHistoryLength) break;
        await cursor.delete();
        count--;
      }

      await tx.done;

      return data;
    });
  }

  /**
   * Clears the history.
   */
  static async clear(): Promise<void> {
    const db = await Idb.getIndexedDB();
    await db.clear(IdbStore.History);
  }

  /**
   * Gets entries from the history, from the newest to the oldest.
   * @param limit The maximum number of entries to retrieve. If no limit is specified or if the value is less than or equal to zero, all entries are returned.
   * @returns An array of entries.
   */
  static async get(limit?: number): Promise<IdbEntry[]> {
    const max = limit && Number.isInteger(limit) && limit > 0 ? limit : Infinity;

    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.History);

    const history: IdbEntry[] = [];
    for await (const cursor of tx.store.iterate(null, "prev")) {
      history.push(cursor.value);
      if (history.length >= max) break;
    }

    await tx.done;

    return history;
  }
}
