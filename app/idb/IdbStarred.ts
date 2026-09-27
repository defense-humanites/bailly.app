import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
} from "./Idb";
import { entryTombstone, type StarredRecord } from "./merge";

const toEntry = ({ word, uri, excerpt }: StarredRecord): IdbEntry => ({ word, uri, excerpt });

/**
 * A collection of methods for managing starred entries (aka the favorites).
 * @remarks The favorites are limited like tags (cf. `Idb.config.tagMaxItems`).
 * Removed entries leave a tombstone (cf. `merge.ts`), ignored when reading.
 */
export class IdbStarred {
  /**
   * Gets a starred entry.
   * @param uri The URI of the requested entry.
   * @returns An entry or `null`.
   */
  static async get(uri: string): Promise<IdbEntry | null> {
    const db = await Idb.getIndexedDB();
    const record = await db.get(IdbStore.Starred, uri);
    return record && !record.deleted ? toEntry(record) : null;
  }

  /**
   * Gets all the starred entries.
   * @returns An array of entries.
   */
  static async getAll(): Promise<IdbEntry[]> {
    const db = await Idb.getIndexedDB();
    return (await db.getAll(IdbStore.Starred)).filter(record => !record.deleted).map(toEntry);
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
      const tx = db.transaction([IdbStore.Starred, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Starred);

      const live = (await store.getAll()).filter(record => !record.deleted);
      if (live.length >= Idb.config.tagMaxItems) {
        throw new IdbError(
          `Les favoris ne peuvent contenir plus de ${Idb.config.tagMaxItems} entrées.`,
        );
      }

      if (live.some(record => record.uri === data.uri)) {
        throw new IdbError(`L'entrée ${data.word} a déjà été ajoutée aux favoris.`);
      }

      await store.put({ ...data, updatedAt: await Idb.stamp(tx.objectStore(IdbStore.Meta)) });
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
      const tx = db.transaction([IdbStore.Starred, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Starred);

      const record = await store.get(uri);
      if (!record || record.deleted) {
        throw new IdbError("L'entrée à supprimer n'a pas été ajoutée aux favoris.");
      }

      await store.put(entryTombstone(record, await Idb.stamp(tx.objectStore(IdbStore.Meta))));
      await tx.done;

      return undefined;
    });
  }
}
