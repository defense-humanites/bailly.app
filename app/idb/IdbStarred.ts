import {
  Idb,
  IdbResponse,
  IdbStore,
  type IdbEntryCreation,
  type IdbEntry,
} from "./Idb";

/**
 * A collection of methods for managing starred entries (aka the favorites).
 */
export class IdbStarred {
  /**
   * Gets an a starred entry.
   * @param uri The URI of the requested entry.
   * @returns An entry or `null`.
   */
  static async get(uri: string): Promise<IdbEntry | null> {
    const db = await Idb.getIndexedDB();
    return (await db.getFromIndex(IdbStore.Starred, "uri", uri)) ?? null;
  }

  /**
   * Gets all the starred entries.
   * @returns An array of entries.
   */
  static async getAll(): Promise<IdbEntry[]> {
    const db = await Idb.getIndexedDB();
    return await db.getAll(IdbStore.Starred);
  }

  /**
   * Adds an entry to the starred entries.
   * @param entry An input entry to convert into an `IdbEntry`.
   * @returns The starred entry.
   * @returns A response object containing the inserted entry if the operation is successful; otherwise returns an error.
   */
  static async add(entry: IdbEntryCreation): Promise<IdbResponse<IdbEntry>> {
    try {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Starred, "readwrite");

      const countEntries = await tx.store.count();
      if (countEntries >= Idb.config.tagMaxItems) {
        throw new Error(
          `Les favoris ne peuvent contenir plus de ${Idb.config.tagMaxItems} entrées.`
        );
      }

      const uriExists = await tx.store.index("uri").get(entry.uri);
      if (uriExists) {
        throw new Error(
          `L'entrée ${entry.word} a déjà été ajoutée aux favoris.`
        );
      }

      const data: IdbEntry = Idb.buildIdbEntry(entry);
      await tx.store.add(data);
      await tx.done;

      return new IdbResponse("success", { data });
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  /**
   * Removes an entry from the starred entries.
   * @param uri The URI of the entry to remove.
   */
  static async remove(uri: string): Promise<IdbResponse> {
    const db = await Idb.getIndexedDB();
    const key = await db.getKeyFromIndex(IdbStore.Starred, "uri", uri);
    if (key) {
      await db.delete(IdbStore.Starred, key);
      return new IdbResponse("success", {});
    } else {
      return IdbResponse.defaultError(
        "L'entrée à supprimer n'a pas été ajoutée aux favoris."
      );
    }
  }
}
