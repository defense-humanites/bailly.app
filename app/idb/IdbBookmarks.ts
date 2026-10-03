import { maxStamp, stampTime } from "./clock";
import { attempt, Idb, IdbError, IdbMetaKey, IdbStore, type IdbMetaStore, type IdbResult } from "./Idb";
import {
  canonical,
  comparableTagName,
  compact,
  entryAddedAt,
  emptyState,
  fitImport,
  limitExcesses,
  latestStamp,
  mergeStates,
  normalize,
  joinRecords,
  recordId,
  restoreRecords,
  withoutTombstones,
  type BookmarksState,
  type LimitExcess,
  type RemovedRecords,
  type SkippedRecords,
} from "./merge";

export type MergeOutcome = {
  state: BookmarksState;
  /**
   * Whether the stored bookmarks changed.
   */
  changed: boolean;
  /**
   * The limits the merge would exceed: if any, nothing was merged (cf.
   * `limitExcesses`).
   */
  excesses: LimitExcess[];
};

/**
 * Methods on the bookmarks as a whole (favorites, tags and tagged entries),
 * with their tombstones: the state that is exported,
 * imported and synchronized.
 */
export class IdbBookmarks {
  /**
   * Brings back records just deleted (cf. `RemovedRecords`: a tag with its
   * entries, an entry), as they were, with a new stamp: their deletion is
   * undone on the other devices too (the latest version wins). An entry
   * keeps its place (`addedAt`). A record changed meanwhile (e.g. added
   * again) is left as it is.
   */
  static async revive(removed: RemovedRecords): Promise<IdbResult> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred, IdbStore.Meta], "readwrite");
      const updatedAt = await Idb.stamp(tx.objectStore(IdbStore.Meta));

      const tags = tx.objectStore(IdbStore.Tags);
      const live = (await tags.getAll()).filter(tag => !tag.deleted);
      for (const tag of removed.tags) {
        const stored = await tags.get(tag.key);
        if (stored && !stored.deleted) continue;
        if (live.some(other => comparableTagName(other.name) === comparableTagName(tag.name))) {
          throw new IdbError(`Une autre étiquette s'appelle désormais « ${tag.name} ».`);
        }
        const { deleted: _deleted, ...record } = tag;
        await tags.put({ ...record, updatedAt });
      }

      const tagged = tx.objectStore(IdbStore.Tagged);
      for (const entry of removed.tagged) {
        const stored = await tagged.get([entry.tagKey, entry.uri]);
        if (stored && !stored.deleted) continue;
        const { deleted: _deleted, ...record } = entry;
        await tagged.put({ ...record, addedAt: entryAddedAt(entry), updatedAt });
      }

      const starred = tx.objectStore(IdbStore.Starred);
      for (const entry of removed.starred) {
        const stored = await starred.get(entry.uri);
        if (stored && !stored.deleted) continue;
        const { deleted: _deleted, ...record } = entry;
        await starred.put({ ...record, addedAt: entryAddedAt(entry), updatedAt });
      }

      await tx.done;
      return undefined;
    });
  }

  /**
   * Reads the whole state.
   * @returns The state, in canonical form (records sorted by identity).
   */
  static async getState(): Promise<BookmarksState> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred]);
    const [tags, tagged, starred] = await Promise.all([
      tx.objectStore(IdbStore.Tags).getAll(),
      tx.objectStore(IdbStore.Tagged).getAll(),
      tx.objectStore(IdbStore.Starred).getAll(),
    ]);
    await tx.done;

    return mergeStates({ tags, tagged, starred }, emptyState());
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
   * deletions (cf. `joinRecords`), which are forgotten: made outside this
   * synchronization, they must not delete anything on the other devices
   * either (e.g. when the server had emptied the locker, and the device
   * fills it again).
   * @returns The merged state, and whether the stored one changed.
   */
  static async join(remote: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    return IdbBookmarks.#mergeInto(
      // Brought back as changes made now: after the stamps of the locker.
      async (local, meta) => joinRecords(local, remote, await Idb.stamp(meta, latestStamp(remote))),
      { forgetDeletions: true },
    );
  }

  /**
   * Restores an imported state (a backup): what the file contains comes back
   * (even if deleted since), without undoing later changes nor deleting
   * anything (cf. `restoreRecords`).
   * @returns The merged state, and whether the stored one changed.
   */
  static async restore(imported: BookmarksState): Promise<IdbResult<MergeOutcome & { skipped: SkippedRecords }>> {
    let skipped: SkippedRecords = { tags: 0, entries: 0 };
    const result = await IdbBookmarks.#mergeInto(async (local, meta) => {
      const fitted = fitImport(local, imported, Idb.config);
      skipped = fitted.skipped;
      // Brought back as changes made now: after the stamps of the file's
      // records (not of its tombstones, which a restore ignores: they would
      // move this device's clock for nothing).
      return restoreRecords(local, fitted.state, await Idb.stamp(meta, latestStamp(withoutTombstones(fitted.state))));
    });
    return result.state === "success" ? { ...result, data: { ...result.data, skipped } } : result;
  }

  /**
   * What `restore` would leave out of an imported state to keep within the
   * limits (nothing is written).
   */
  static async previewRestore(imported: BookmarksState): Promise<SkippedRecords> {
    return fitImport(await IdbBookmarks.getState(), imported, Idb.config).skipped;
  }

  /**
   * The reference time for the stamps received (cf. `MAX_FUTURE_DRIFT`): the
   * later of this device's time and of its logical clock, which has followed
   * the stamps it observed. A device whose clock is late (but which has
   * already merged recent changes) does not reject the others' changes.
   */
  static async referenceTime(): Promise<number> {
    const db = await Idb.getIndexedDB();
    const clock = await Idb.getMeta(db.transaction(IdbStore.Meta).objectStore(IdbStore.Meta), IdbMetaKey.Clock);
    return Math.max(Date.now(), clock ? stampTime(clock) : 0);
  }

  /**
   * The excerpts kept on this device, by URI (cf. `IdbExcerpt`).
   */
  static async getExcerpts(): Promise<Map<string, string>> {
    const db = await Idb.getIndexedDB();
    return Idb.readExcerpts(db.transaction(IdbStore.Excerpts).objectStore(IdbStore.Excerpts));
  }

  /**
   * The URIs of the (live) bookmarks of a state.
   */
  static #bookmarkedUris(state: Pick<BookmarksState, "tags" | "tagged" | "starred">): Set<string> {
    const liveTags = new Set(state.tags.filter(tag => !tag.deleted).map(tag => tag.key));
    const uris = new Set<string>();
    for (const record of state.starred) {
      if (!record.deleted) uris.add(record.uri);
    }
    for (const record of state.tagged) {
      if (!record.deleted && liveTags.has(record.tagKey)) uris.add(record.uri);
    }
    return uris;
  }

  /**
   * The URIs of the bookmarks whose excerpt is not known on this device (e.g.
   * received from another one, cf. `IdbExcerpt`).
   */
  static async missingExcerpts(): Promise<string[]> {
    const [state, excerpts] = await Promise.all([IdbBookmarks.getState(), IdbBookmarks.getExcerpts()]);
    return [...IdbBookmarks.#bookmarkedUris(state)].filter(uri => !excerpts.has(uri));
  }

  /**
   * Keeps the excerpts fetched for bookmarks (not a change of the bookmarks:
   * nothing is stamped nor synchronized).
   * @param excerpts The excerpts, by URI (those of entries no longer
   * bookmarked are left out).
   * @returns Whether an excerpt was added or changed.
   */
  static async fillExcerpts(excerpts: Map<string, string>): Promise<IdbResult<{ changed: boolean }>> {
    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred, IdbStore.Excerpts], "readwrite");
      const bookmarked = IdbBookmarks.#bookmarkedUris({
        tags: await tx.objectStore(IdbStore.Tags).getAll(),
        tagged: await tx.objectStore(IdbStore.Tagged).getAll(),
        starred: await tx.objectStore(IdbStore.Starred).getAll(),
      });
      const store = tx.objectStore(IdbStore.Excerpts);
      const known = await Idb.readExcerpts(store);

      let changed = false;
      for (const [uri, excerpt] of excerpts) {
        if (!excerpt || !bookmarked.has(uri) || known.get(uri) === excerpt) continue;
        await store.put({ uri, excerpt });
        changed = true;
      }
      await tx.done;
      return { changed };
    });
  }

  /**
   * Forgets the tombstones old enough (cf. `compact`): they are not sent
   * anymore, and need not be kept; and the excerpts of the entries no longer
   * bookmarked.
   * @returns The state, and whether the stored one changed.
   */
  static async compact(): Promise<IdbResult<MergeOutcome>> {
    const result = await IdbBookmarks.#mergeInto(() => Promise.resolve(emptyState()));
    if (result.state === "error") return result;

    return attempt(async () => {
      const db = await Idb.getIndexedDB();
      const tx = db.transaction([IdbStore.Tags, IdbStore.Tagged, IdbStore.Starred, IdbStore.Excerpts], "readwrite");
      const bookmarked = IdbBookmarks.#bookmarkedUris({
        tags: await tx.objectStore(IdbStore.Tags).getAll(),
        tagged: await tx.objectStore(IdbStore.Tagged).getAll(),
        starred: await tx.objectStore(IdbStore.Starred).getAll(),
      });
      const store = tx.objectStore(IdbStore.Excerpts);
      for (const uri of await store.getAllKeys()) {
        if (!bookmarked.has(uri)) await store.delete(uri);
      }
      await tx.done;
      return result.data;
    });
  }

  /**
   * Merges a state into the stored one, in a single transaction: only the
   * records that change are written (and the tombstones old enough are
   * forgotten, cf. `compact`), and the clock moves past the merged stamps, so
   * that later changes on this device supersede them. A merge that would
   * exceed the limits is not applied (cf. `limitExcesses`).
   * @param incoming The state to merge, from the stored one.
   * @param options.forgetDeletions Whether the stored tombstones are forgotten.
   */
  static async #mergeInto(
    incoming: (local: BookmarksState, meta: IdbMetaStore) => Promise<BookmarksState>,
    { forgetDeletions = false }: { forgetDeletions?: boolean } = {},
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
      };
      const received = await incoming(local, stores.meta);
      const merged = compact(normalize(mergeStates(forgetDeletions ? withoutTombstones(local) : local, received)));

      // Beyond the limits: nothing is merged (the user makes room first).
      const excesses = limitExcesses(merged, Idb.config, received);
      if (excesses.length) {
        await tx.done;
        return { state: local, changed: false, excesses };
      }

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
      };
      for (const record of changes.tags) await stores.tags.put(record);
      for (const record of changes.tagged) await stores.tagged.put(record);
      for (const record of changes.starred) await stores.starred.put(record);

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
        changed: Boolean(changes.tags.length || changes.tagged.length || changes.starred.length),
        excesses: [],
      };
    });
  }
}
