import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
} from "./Idb";

/**
 * A collection of methods for managing starred entries (aka the favorites).
 * @remarks The favorites are limited like tags (cf. `Idb.config.tagMaxItems`).
 */
export class IdbStarred {
  /**
   * Gets a starred entry.
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
   */
  static async add(entry: IdbEntryCreation): Promise<IdbResult<IdbEntry>> {
    return attempt(async () => {
      const data: IdbEntry = Idb.buildIdbEntry(entry);

      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Starred, "readwrite");

      if ((await tx.store.count()) >= Idb.config.tagMaxItems) {
        throw new IdbError(
          `Les favoris ne peuvent contenir plus de ${Idb.config.tagMaxItems} entrées.`,
        );
      }

      if ((await tx.store.index("uri").getKey(data.uri)) !== undefined) {
        throw new IdbError(`L'entrée ${data.word} a déjà été ajoutée aux favoris.`);
      }

      await tx.store.add(data);
      await tx.done;

      return data;
    });
  }

  /**
   * Removes an entry from the starred entries.
   * @param uri The URI of the entry to remove.
   */
  static async remove(uri: string): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Starred, "readwrite");

      const key = await tx.store.index("uri").getKey(uri);
      if (key === undefined) {
        throw new IdbError("L'entrée à supprimer n'a pas été ajoutée aux favoris.");
      }

      await tx.store.delete(key);
      await tx.done;

      return undefined;
    });
  }
}
