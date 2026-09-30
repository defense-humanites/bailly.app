import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
} from "./Idb";
import { latestFirst } from "./clock";
import { entryTombstone, type StarredRecord } from "./merge";

/**
 * A favorite as shown, with its excerpt if known (cf. `IdbExcerpt`).
 */
const toEntry = ({ word, uri }: StarredRecord, excerpt: string | undefined): IdbEntry => ({ word, uri, excerpt: excerpt ?? "" });

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
    const tx = db.transaction([IdbStore.Starred, IdbStore.Excerpts]);
    const [record, excerpt] = await Promise.all([
      tx.objectStore(IdbStore.Starred).get(uri),
      tx.objectStore(IdbStore.Excerpts).get(uri),
    ]);
    await tx.done;
    return record && !record.deleted ? toEntry(record, excerpt?.excerpt) : null;
  }

  /**
   * Gets all the starred entries.
   * @returns An array of entries, the latest added first.
   */
  static async getAll(): Promise<IdbEntry[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Starred, IdbStore.Excerpts]);
    const [records, excerpts] = await Promise.all([
      tx.objectStore(IdbStore.Starred).getAll(),
      Idb.readExcerpts(tx.objectStore(IdbStore.Excerpts)),
    ]);
    await tx.done;
    return records
      .filter(record => !record.deleted)
      .sort(latestFirst)
      .map(record => toEntry(record, excerpts.get(record.uri)));
  }

  /**
   * Adds an entry to the starred entries.
   * @param entry An input entry to convert into an `IdbEntry`.
   * @returns The starred entry.
   */
  static async add(entry: IdbEntryCreation): Promise<IdbResult<IdbEntry>> {
    return attempt(async () => {
      const data: IdbEntry = Idb.buildIdbEntry(entry, { requireExcerpt: false });

      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Starred, IdbStore.Meta, IdbStore.Excerpts], "readwrite");
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

      await store.put({ uri: data.uri, word: data.word, updatedAt: await Idb.stamp(tx.objectStore(IdbStore.Meta)) });
      if (data.excerpt) await tx.objectStore(IdbStore.Excerpts).put({ uri: data.uri, excerpt: data.excerpt });
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
