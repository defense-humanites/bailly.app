import { maxStamp } from "./clock";
import { attempt, Idb, IdbMetaKey, IdbStore, type IdbMetaStore, type IdbResult } from "./Idb";
import {
  canonical,
  compact,
  emptyState,
  enforceLimits,
  latestStamp,
  mergeStates,
  normalize,
  joinRecords,
  recordId,
  restoreRecords,
  type BookmarksState,
  type DroppedRecords,
} from "./merge";

export type MergeOutcome = {
  state: BookmarksState;
  /**
   * Whether the stored bookmarks changed.
   */
  changed: boolean;
  /**
   * The bookmarks deleted to keep within the limits (cf. `enforceLimits`).
   */
  dropped: DroppedRecords;
};

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
   * Merges a state from another device into the stored one (the latest
   * version of each record wins, cf. `merge.ts`).
   * @returns The merged state, and whether the stored one changed.
   */
  static async merge(remote: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    return IdbBookmarks.#mergeInto(() => Promise.resolve(remote));
  }

  /**
   * Merges the state of the locker the first time this device synchronizes
   * with a key: what exists online is not deleted by this device's earlier
   * deletions (cf. `joinRecords`).
   * @returns The merged state, and whether the stored one changed.
   */
  static async join(remote: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    return IdbBookmarks.#mergeInto(async (local, meta) => joinRecords(local, remote, await Idb.stamp(meta)));
  }

  /**
   * Restores an imported state (a backup): what the file contains comes back
   * (even if deleted since), without undoing later changes nor deleting
   * anything (cf. `restoreRecords`).
   * @returns The merged state, and whether the stored one changed.
   */
  static async restore(imported: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    return IdbBookmarks.#mergeInto(async (local, meta) => restoreRecords(local, imported, await Idb.stamp(meta)));
  }

  /**
   * Forgets the tombstones old enough (cf. `compact`): they are not sent
   * anymore, and need not be kept.
   * @returns The state, and whether the stored one changed.
   */
  static async compact(): Promise<IdbResult<MergeOutcome>> {
    return IdbBookmarks.#mergeInto(() => Promise.resolve(emptyState()));
  }

  /**
   * Merges a state into the stored one, in a single transaction: only the
   * records that change are written (and the tombstones old enough are
   * forgotten, cf. `compact`), and the clock moves past the merged stamps, so
   * that later changes on this device supersede them. The bookmarks are kept
   * within the limits (cf. `enforceLimits`).
   * @param incoming The state to merge, from the stored one.
   */
  static async #mergeInto(
    incoming: (local: BookmarksState, meta: IdbMetaStore) => Promise<BookmarksState>,
  ): Promise<IdbResult<MergeOutcome>> {
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
      const limited = enforceLimits(normalize(mergeStates(local, await incoming(local, stores.meta))), Idb.config);
      const merged = compact(limited.state);

      /**
       * The records of a kind that differ from the stored ones.
       */
      const changed = <T>(id: (record: T) => string, before: T[], after: T[]): T[] => {
        const stored = new Map(before.map(record => [id(record), canonical(record)]));
        return after.filter(record => stored.get(id(record)) !== canonical(record));
      };

      /**
       * The stored records of a kind that are forgotten (old tombstones).
       */
      const forgotten = <T>(id: (record: T) => string, before: T[], after: T[]): T[] => {
        const kept = new Set(after.map(id));
        return before.filter(record => !kept.has(id(record)));
      };

      const changes = {
        tags: changed(recordId.tag, local.tags, merged.tags),
        tagged: changed(recordId.tagged, local.tagged, merged.tagged),
        starred: changed(recordId.starred, local.starred, merged.starred),
        tagOrder: merged.tagOrder && canonical(merged.tagOrder) !== canonical(local.tagOrder) ? merged.tagOrder : null,
      };
      for (const record of changes.tags) await stores.tags.put(record);
      for (const record of changes.tagged) await stores.tagged.put(record);
      for (const record of changes.starred) await stores.starred.put(record);
      if (changes.tagOrder) await stores.meta.put(changes.tagOrder, IdbMetaKey.TagOrder);

      // Forgetting a tombstone changes nothing that shows (`changed` stays
      // false): no need to tell the other tabs.
      for (const record of forgotten(recordId.tag, local.tags, merged.tags)) await stores.tags.delete(record.key);
      for (const record of forgotten(recordId.tagged, local.tagged, merged.tagged)) {
        await stores.tagged.delete([record.tagKey, record.uri]);
      }
      for (const record of forgotten(recordId.starred, local.starred, merged.starred)) await stores.starred.delete(record.uri);

      const clock = maxStamp(await Idb.getMeta(stores.meta, IdbMetaKey.Clock), latestStamp(merged));
      if (clock) await stores.meta.put(clock, IdbMetaKey.Clock);

      await tx.done;

      return {
        state: merged,
        changed: Boolean(changes.tags.length || changes.tagged.length || changes.starred.length || changes.tagOrder),
        dropped: limited.dropped,
      };
    });
  }
}
