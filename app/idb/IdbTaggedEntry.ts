import {
  attempt,
  Idb,
  IdbError,
  IdbStore,
  type IdbEntryCreation,
  type IdbResult,
  type IdbTagged,
} from "./Idb";
import type { TaggedRecord, TagKey } from "./merge";

const toTagged = ({ tagKey, word, uri, excerpt }: TaggedRecord): IdbTagged => ({ tagKey, word, uri, excerpt });

/**
 * A collection of methods for managing tagged entries.
 * @remarks Detached entries leave a tombstone (cf. `merge.ts`); they are
 * ignored when reading, as are the entries of a deleted tag (which a merge
 * may bring: e.g. an entry added on a device to a tag deleted on another).
 */
export class IdbTaggedEntry {
  /**
   * Associates an entry with a tag.
   * @param entry An input entry to convert into an `IdbTagged`.
   * @param tagKey The key of the tag to which the entry must belong.
   * @returns The inserted entry with its tag key.
   */
  static async add(
    entry: IdbEntryCreation,
    tagKey: TagKey,
  ): Promise<IdbResult<IdbTagged>> {
    return attempt(async () => {
      const taggedEntry: IdbTagged = { tagKey, ...Idb.buildIdbEntry(entry) };

      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tagged, IdbStore.Tags, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Tagged);

      const tag = await tx.objectStore(IdbStore.Tags).get(tagKey);
      if (!tag || tag.deleted) {
        throw new IdbError("L'étiquette demandée n'existe pas.");
      }

      const live = (await store.index("tagKey").getAll(tagKey)).filter(record => !record.deleted);
      if (live.some(record => record.uri === taggedEntry.uri)) {
        throw new IdbError(`L'étiquette contient déjà l'entrée ${taggedEntry.word}.`);
      }

      if (live.length >= Idb.config.tagMaxItems) {
        throw new IdbError(
          `L'étiquette ne peut contenir plus de ${Idb.config.tagMaxItems} entrées.`,
        );
      }

      await store.put({ ...taggedEntry, updatedAt: await Idb.stamp(tx.objectStore(IdbStore.Meta)) });
      await tx.done;

      return taggedEntry;
    });
  }

  /**
   * Detaches an entry from a tag.
   * @param uri The URI of the entry to detach.
   * @param tagKey The key of the tag to which the entry must not belong anymore.
   */
  static async remove(uri: string, tagKey: TagKey): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tagged, IdbStore.Meta], "readwrite");
      const store = tx.objectStore(IdbStore.Tagged);

      const record = await store.get([tagKey, uri]);
      if (!record || record.deleted) {
        throw new IdbError("L'étiquette ne référence pas l'entrée à supprimer.");
      }

      await store.put({ ...record, deleted: true, updatedAt: await Idb.stamp(tx.objectStore(IdbStore.Meta)) });
      await tx.done;

      return undefined;
    });
  }

  /**
   * Gets a tagged entry.
   * @param uri The URI of the requested entry.
   * @param tagKey The key of the tag to which the entry must belong.
   * @returns An entry with its tag key or `null`.
   */
  static async get(uri: string, tagKey: TagKey): Promise<IdbTagged | null> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Tagged, IdbStore.Tags]);
    const [record, tag] = await Promise.all([
      tx.objectStore(IdbStore.Tagged).get([tagKey, uri]),
      tx.objectStore(IdbStore.Tags).get(tagKey),
    ]);
    await tx.done;

    return record && !record.deleted && tag && !tag.deleted ? toTagged(record) : null;
  }

  /**
   * Gets all the tagged entries (of the existing tags).
   * @returns An array of entries with their tag key.
   */
  static async getAll(): Promise<IdbTagged[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Tagged, IdbStore.Tags]);
    const [records, tags] = await Promise.all([
      tx.objectStore(IdbStore.Tagged).getAll(),
      tx.objectStore(IdbStore.Tags).getAll(),
    ]);
    await tx.done;

    const liveTags = new Set(tags.filter(tag => !tag.deleted).map(tag => tag.key));
    return records.filter(record => !record.deleted && liveTags.has(record.tagKey)).map(toTagged);
  }
}
