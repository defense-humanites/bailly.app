import { maxStamp } from "./clock";
import { attempt, Idb, IdbMetaKey, IdbStore, type IdbResult } from "./Idb";
import {
  canonical,
  emptyState,
  latestStamp,
  mergeStates,
  normalize,
  recordId,
  type BookmarksState,
} from "./merge";

/**
 * Methods on the bookmarks as a whole (favorites, tags, tagged entries and
 * the order of the tags), with their tombstones: the state that is exported,
 * imported and synchronized.
 */
export class IdbBookmarks {
  /**
   * Reads the whole state.
   * @returns The state, in canonical form (records sorted by identity).
   */
  static async getState(): Promise<BookmarksState> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred, IdbStore.Meta]);
    const [tags, tagged, starred, tagOrder] = await Promise.all([
      tx.objectStore(IdbStore.Tags).getAll(),
      tx.objectStore(IdbStore.Tagged).getAll(),
      tx.objectStore(IdbStore.Starred).getAll(),
      Idb.getMeta(tx.objectStore(IdbStore.Meta), IdbMetaKey.TagOrder),
    ]);
    await tx.done;

    return mergeStates({ tags, tagged, starred, tagOrder: tagOrder ?? null }, emptyState());
  }

  /**
   * Merges a state (e.g. imported, or from another device) into the stored
   * one, in a single transaction: only the records that change are written,
   * and the clock moves past the merged stamps, so that later changes on this
   * device supersede them.
   * @returns The merged state.
   */
  static async merge(remote: BookmarksState): Promise<IdbResult<BookmarksState>> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred, IdbStore.Meta], "readwrite");
      const stores = {
        tags: tx.objectStore(IdbStore.Tags),
        tagged: tx.objectStore(IdbStore.Tagged),
        starred: tx.objectStore(IdbStore.Starred),
        meta: tx.objectStore(IdbStore.Meta),
      };

      const local: BookmarksState = {
        tags: await stores.tags.getAll(),
        tagged: await stores.tagged.getAll(),
        starred: await stores.starred.getAll(),
        tagOrder: (await Idb.getMeta(stores.meta, IdbMetaKey.TagOrder)) ?? null,
      };
      const merged = normalize(mergeStates(local, remote));

      /**
       * The records of a kind that differ from the stored ones.
       */
      const changed = <T>(id: (record: T) => string, before: T[], after: T[]): T[] => {
        const stored = new Map(before.map(record => [id(record), canonical(record)]));
        return after.filter(record => stored.get(id(record)) !== canonical(record));
      };

      for (const record of changed(recordId.tag, local.tags, merged.tags)) await stores.tags.put(record);
      for (const record of changed(recordId.tagged, local.tagged, merged.tagged)) await stores.tagged.put(record);
      for (const record of changed(recordId.starred, local.starred, merged.starred)) await stores.starred.put(record);
      if (merged.tagOrder && canonical(merged.tagOrder) !== canonical(local.tagOrder)) {
        await stores.meta.put(merged.tagOrder, IdbMetaKey.TagOrder);
      }

      const clock = maxStamp(await Idb.getMeta(stores.meta, IdbMetaKey.Clock), latestStamp(merged));
      if (clock) await stores.meta.put(clock, IdbMetaKey.Clock);

      await tx.done;

      return merged;
    });
  }
}
