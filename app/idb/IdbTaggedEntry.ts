import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type IdbEntryCreation,
  type IdbResult,
  type IdbTagged,
} from "./Idb";

/**
 * A collection of methods for managing tagged entries.
 */
export class IdbTaggedEntry {
  /**
   * Associates an entry with a tag.
   * @param entry An input entry to convert into an `IdbTagged`.
   * @param tagKey The primary key of the tag to which the entry must belong.
   * @returns The inserted entry with its tag key.
   */
  static async add(
    entry: IdbEntryCreation,
    tagKey: number,
  ): Promise<IdbResult<IdbTagged>> {
    return attempt(async () => {
      const taggedEntry: IdbTagged = { tagKey, ...Idb.buildIdbEntry(entry) };

      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tagged, IdbStore.Tags], "readwrite");
      const store = tx.objectStore(IdbStore.Tagged);

      if ((await tx.objectStore(IdbStore.Tags).getKey(tagKey)) === undefined) {
        throw new IdbError("L'étiquette demandée n'existe pas.");
      }

      if ((await store.index("tagKey+uri").getKey([tagKey, taggedEntry.uri])) !== undefined) {
        throw new IdbError(`L'étiquette contient déjà l'entrée ${taggedEntry.word}.`);
      }

      if ((await store.index("tagKey").count(tagKey)) >= Idb.config.tagMaxItems) {
        throw new IdbError(
          `L'étiquette ne peut contenir plus de ${Idb.config.tagMaxItems} entrées.`,
        );
      }

      await store.add(taggedEntry);
      await tx.done;

      return taggedEntry;
    });
  }

  /**
   * Detaches an entry from a tag.
   * @param uri The URI of the entry to detach.
   * @param tagKey The primary key of the tag to which the entry must not belong anymore.
   */
  static async remove(uri: string, tagKey: number): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction(IdbStore.Tagged, "readwrite");

      const key = await tx.store.index("tagKey+uri").getKey([tagKey, uri]);
      if (key === undefined) {
        throw new IdbError("L'étiquette ne référence pas l'entrée à supprimer.");
      }

      await tx.store.delete(key);
      await tx.done;

      return undefined;
    });
  }

  /**
   * Gets a tagged entry.
   * @param uri The URI of the requested entry.
   * @param tagKey The primary key of the tag to which the entry must belong.
   * @returns An entry with its tag key or `null`.
   */
  static async get(uri: string, tagKey: number): Promise<IdbTagged | null> {
    const db = await Idb.getIndexedDB();
    return (await db.getFromIndex(IdbStore.Tagged, "tagKey+uri", [tagKey, uri])) ?? null;
  }

  /**
   * Gets all the tagged entries.
   * @returns An array of entries with their tag key.
   */
  static async getAll(): Promise<IdbTagged[]> {
    const db = await Idb.getIndexedDB();
    return await db.getAll(IdbStore.Tagged);
  }
}
