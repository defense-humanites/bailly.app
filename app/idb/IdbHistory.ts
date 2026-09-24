import {
  Idb,
  type IdbEntry,
  type IdbEntryCreation,
  IdbResponse,
  IdbStore,
} from "./Idb";

/**
 * A collection of methods for managing the history of viewed entries.
 */
export class IdbHistory {
  /**
   * Removes entries that exceed the history length setting (cf. `Idb.config`).
   */
  static async #removeExtraItems(): Promise<void> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.History, "readwrite");

    let count = await tx.store.count();
    for await (const cursor of tx.store) {
      if (count <= Idb.config.searchHistoryLength) break;
      await cursor.delete();
      count--;
    }

    await tx.done;
  }

  /**
   * Adds a new item entry the history.
   * @param entry A given entry to convert into an `IdbEntry`.
   * @returns A response object containing the inserted entry if the operation is successful; otherwise returns an error.
   */
  static async add(entry: IdbEntryCreation): Promise<IdbResponse<IdbEntry>> {
    try {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.History, "readwrite");
      const data: IdbEntry = Idb.buildIdbEntry(entry);

      const key = await tx.store.index("uri").getKey(data.uri);
      if (key) await tx.store.delete(key);

      await tx.store.add(data);
      await tx.done;

      await IdbHistory.#removeExtraItems();

      return new IdbResponse("success", { data });
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  /**
   * Clears the history.
   */
  static async clear(): Promise<void> {
    const db = await Idb.getIndexedDB();
    await db.clear(IdbStore.History);
  }

  /**
   * Gets entries from the history.
   * @param limit The maximum number of entries to retrieve. If no limit is specified or if the value is less than or equal to zero, all entries are returned.
   * @returns An array of entries.
   */
  static async get(limit?: number): Promise<IdbEntry[]> {
    if (!limit || !Number.isInteger(limit) || limit <= 0) limit = -1;

    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.History);

    let cursor = await tx.store.openCursor(null, "prev");
    const history: IdbEntry[] = [];
    while (cursor) {
      history.push(cursor.value);

      limit--;
      if (limit === 0) break;

      cursor = await cursor.continue();
    }

    await tx.done;

    return history;
  }
}
