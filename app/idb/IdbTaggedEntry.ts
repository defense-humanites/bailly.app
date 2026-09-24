import { LocalStorageKey } from "~/enums";
import {
  Idb,
  IdbResponse,
  IdbStore,
  type IdbEntryCreation,
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
   * @param opts An optional configuration object.
   * @param opts.setCurrentTag Update the tag marked as current with the used `tagKey`.
   * @returns A response object containing the inserted entry with its tag key if the operation is successful; otherwise returns an error.
   */
  static async add(
    entry: IdbEntryCreation,
    tagKey: number,
    opts?: {
      setCurrentTag: boolean;
    },
  ): Promise<IdbResponse<IdbTagged>> {
    try {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tagged, IdbStore.Tags], "readwrite");
      const store = tx.objectStore(IdbStore.Tagged);

      if (!(await tx.objectStore(IdbStore.Tags).getKey(tagKey))) {
        throw new Error("L'étiquette demandée n'existe pas.");
      }

      if (await store.index("tagKey+uri").getKey([tagKey, entry.uri])) {
        throw new Error(`L'étiquette contient déjà l'entrée ${entry.word}.`);
      }

      const countEntries = await store.index("tagKey").count(tagKey);
      if (countEntries >= Idb.config.tagMaxItems) {
        throw new Error(
          `L'étiquette ne peut contenir plus de ${Idb.config.tagMaxItems} entrées.`,
        );
      }

      const taggedEntry: IdbTagged = {
        tagKey: tagKey,
        ...Idb.buildIdbEntry(entry),
      };

      await store.add(taggedEntry);
      await tx.done;

      if (opts?.setCurrentTag) {
        localStorage.setItem(LocalStorageKey.CurrentTagKey, String(tagKey));
      }

      return new IdbResponse("success", { data: taggedEntry });
    } catch (error: unknown) {
      return IdbResponse.defaultError(error);
    }
  }

  /**
   * Detaches an entry from a tag.
   * @param uri The URI of the entry to detach.
   * @param tagKey The primary key of the tag to which the entry must not belong anymore.
   */
  static async remove(uri: string, tagKey: number): Promise<IdbResponse> {
    const db = await Idb.getIndexedDB();
    const key = await db.getKeyFromIndex(
      IdbStore.Tagged,
      "tagKey+uri",
      IDBKeyRange.only([tagKey, uri]),
    );

    if (key) {
      await db.delete(IdbStore.Tagged, key);
      return new IdbResponse("success", {});
    } else {
      return IdbResponse.defaultError(
        "L'étiquette ne référence pas l'entrée à supprimer.",
      );
    }
  }

  /**
   * Gets a tagged entry.
   * @param uri The URI of the requested entry.
   * @param tagKey The primary key of the tag to which the entry must belong.
   * @returns An entry with its tag key or `null`.
   */
  static async get(uri: string, tagKey: number): Promise<IdbTagged | null> {
    const db = await Idb.getIndexedDB();
    const taggedEntry = await db.getFromIndex(
      IdbStore.Tagged,
      "tagKey+uri",
      IDBKeyRange.only([tagKey, uri]),
    );

    return taggedEntry ?? null;
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
