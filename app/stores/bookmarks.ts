import { defineStore, skipHydrate } from "pinia";
import { StorageKey } from "~/enums";
import {
  attempt,
  IdbBookmarks,
  IdbStarred,
  IdbTaggedEntry,
  IdbTags,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
  type IdbTagCreation,
  type IdbTagged,
  type IdbTagWithKey,
  type BookmarksState,
  type MergeOutcome,
  type SkippedRecords,
  type TagColorKey,
  type TagKey,
} from "~/idb";
import { comparableTagName, type RemovedRecords } from "~/idb/merge";
import { parseBookmarksFile, toBookmarksFile, type BookmarksFile } from "~/idb/transfer";
import type { ApiExcerptsData, ApiResponse } from "#shared/types/api";
import { MAX_EXCERPTS_URIS, toApiQuery } from "#shared/utils/api";

/**
 * A store for bookmarks-related data (favorites, tags and tagged entries).
 * @remarks The store is the source of truth for the components: it mirrors
 * the data stored in IndexedDB, and keeps the key of the current tag in
 * `localStorage`. It is initialized on the client (cf. `plugins/bookmarks.client.ts`).
 */
export const useBookmarksStore = defineStore("bookmarks", () => {
  const toast = useToast();
  const { $api } = useNuxtApp();

  /**
   * A boolean representing whether the data has been loaded from IndexedDB.
   */
  const initialized = ref(false);
  /**
   * List of existing tags, the pinned ones first (cf. `orderTags`).
   */
  const tags = ref<IdbTagWithKey[]>([]);
  /**
   * Entries linked to tags, sorted alphabetically.
   */
  const taggedEntries = ref<IdbTagged[]>([]);
  /**
   * Entries marked as favorites.
   */
  const starredEntries = ref<IdbEntry[]>([]);
  /**
   * The color to suggest when creating a new tag (inferred from those already used).
   */
  const newTagColor = ref<TagColorKey>();
  /**
   * The key of the current tag, on which to perform actions if no other tag is
   * explicitly chosen.
   * @remarks Stored in the local storage (the key of the previous application
   * is migrated, cf. `utils/legacyStorage.ts`; a numeric key, from before the
   * tags had UUIDs, is resolved by `fetchTags`). Not hydrated from the server,
   * which cannot read it.
   */
  const currentTagKey = skipHydrate(useLocalStorage<TagKey | null>(
    StorageKey.CurrentTag,
    null,
    {
      writeDefaults: false,
      serializer: {
        read: (value: string) => (value && value !== "null" ? value : null),
        write: (value: TagKey | null) => String(value),
      },
    },
  ));

  /**
   * The current tag, if any.
   */
  const currentTag = computed(
    (): IdbTagWithKey | null => tags.value.find(tag => tag.key === currentTagKey.value) ?? null,
  );

  const starredUris = computed(() => new Set(starredEntries.value.map(entry => entry.uri)));

  /**
   * Whether an entry has been starred.
   */
  const isStarred = (uri: string): boolean => starredUris.value.has(uri);
  /**
   * The keys of the tags to which an entry belongs.
   */
  const tagKeysOf = (uri: string): TagKey[] =>
    taggedEntries.value.filter(entry => entry.uri === uri).map(entry => entry.tagKey);
  /**
   * The entries that belong to a tag.
   */
  const entriesOf = (tagKey: TagKey): IdbTagged[] =>
    taggedEntries.value.filter(entry => entry.tagKey === tagKey);

  /**
   * Notifies the user of a failed operation.
   */
  const report = <T>(result: IdbResult<T>): IdbResult<T> => {
    if (result.state === "error") {
      toast.add({
        title: result.message,
        icon: "i-lucide-circle-alert",
        color: "error",
      });
    }
    return result;
  };

  /**
   * The user interactions in progress during which the bookmarks shown must
   * not change under the user's feet (e.g. editing a tag):
   * the synchronization and the reloads asked by other tabs wait for them
   * (cf. `useBookmarksHold`).
   */
  const holds = ref(0);
  const held = computed(() => holds.value > 0);

  /**
   * Holds the bookmarks shown during an interaction.
   * @returns The function that releases the hold (once).
   */
  function hold(): () => void {
    holds.value++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds.value--;
    };
  }

  async function fetchStarredEntries(): Promise<void> {
    starredEntries.value = await IdbStarred.getAll();
  }

  /**
   * Fetches the tags (the pinned ones first, cf. `orderTags`); if the current
   * tag no longer exists (e.g. deleted, here or on another device), the first
   * tag becomes the current one.
   * @remarks A current tag stored before the migration to UUIDs (a numeric
   * key) is found by its former key.
   */
  async function fetchTags(): Promise<void> {
    const previousName = currentTag.value?.name;
    tags.value = await IdbTags.getAll();
    if (currentTag.value) return;

    const legacyCurrentTag = tags.value.find(
      tag => tag.legacyKey !== undefined && String(tag.legacyKey) === currentTagKey.value,
    );
    // A tag fused into its homonym (created on another device, cf.
    // `normalize`): the homonym stays current.
    const homonym = previousName === undefined
      ? undefined
      : tags.value.find(tag => comparableTagName(tag.name) === comparableTagName(previousName));
    currentTagKey.value = (legacyCurrentTag ?? homonym ?? tags.value[0])?.key ?? null;
  }

  async function fetchTaggedEntries(): Promise<void> {
    // The latest added first (as the favorites).
    taggedEntries.value = await IdbTaggedEntry.getAll();
  }

  async function refreshNewTagColor(): Promise<void> {
    newTagColor.value = await IdbTags.pickColor();
  }

  /**
   * The pending initialization, shared by concurrent or repeated calls.
   */
  let initialization: Promise<void> | undefined;

  /**
   * Loads the data stored in IndexedDB.
   * @remarks The other actions await it, so that a pending initialization
   * cannot overwrite their result. After a failure (e.g. the database could
   * not be opened: private browsing, full storage, another tab's lock), the
   * next call tries again, rather than the tab staying without bookmarks
   * until it is reloaded.
   */
  async function initialize(): Promise<void> {
    initialization ??= (async () => {
      await Promise.all([
        fetchTags(),
        fetchTaggedEntries(),
        fetchStarredEntries(),
        refreshNewTagColor(),
      ]);
      initialized.value = true;
    })().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });

    await initialization;
  }

  async function starEntry(entry: IdbEntryCreation): Promise<IdbResult<IdbEntry>> {
    await initialize();
    const result = report(await IdbStarred.add(entry));
    if (result.state === "success") await fetchStarredEntries();
    return result;
  }

  async function unstarEntry(uri: string): Promise<IdbResult<RemovedRecords>> {
    await initialize();
    const result = report(await IdbStarred.remove(uri));
    if (result.state === "success") await fetchStarredEntries();
    return result;
  }

  /**
   * Creates a tag, which becomes the current one.
   * @param options.quiet Whether a failure is left to the caller to show
   * (no toast).
   */
  async function createTag(data: IdbTagCreation, { quiet = false } = {}): Promise<IdbResult<IdbTagWithKey>> {
    await initialize();
    const added = await IdbTags.add(data);
    const result = quiet ? added : report(added);
    if (result.state === "success") {
      currentTagKey.value = result.data.key;
      await Promise.all([fetchTags(), refreshNewTagColor()]);
    }
    return result;
  }

  /**
   * Updates a tag.
   * @param options.quiet Whether a failure is left to the caller to show
   * (no toast).
   */
  async function updateTag(key: TagKey, data: IdbTagCreation, { quiet = false } = {}): Promise<IdbResult<IdbTagWithKey>> {
    await initialize();
    const updated = await IdbTags.update(key, data);
    const result = quiet ? updated : report(updated);
    if (result.state === "success") {
      await fetchTags();
      if (newTagColor.value === result.data.color) await refreshNewTagColor();
    }
    return result;
  }

  /**
   * Pins a tag (it comes first, after those pinned before it) or unpins it;
   * the current tag does not change.
   */
  async function pinTag(key: TagKey, pinned: boolean): Promise<IdbResult<IdbTagWithKey>> {
    await initialize();
    const result = report(await IdbTags.pin(key, pinned));
    // After a failure too (e.g. the tag deleted meanwhile): the tags shown
    // are those stored.
    await fetchTags();
    return result;
  }

  /**
   * Removes a tag and detaches its entries.
   */
  async function removeTag(key: TagKey): Promise<IdbResult<RemovedRecords>> {
    await initialize();
    const result = report(await IdbTags.remove(key));
    if (result.state === "success") {
      await Promise.all([fetchTags(), fetchTaggedEntries(), refreshNewTagColor()]);
    }
    return result;
  }

  function setCurrentTag(key: TagKey): void {
    if (tags.value.some(tag => tag.key === key)) currentTagKey.value = key;
  }

  async function tagEntry(entry: IdbEntryCreation, tagKey: TagKey): Promise<IdbResult<IdbTagged>> {
    await initialize();
    const result = report(await IdbTaggedEntry.add(entry, tagKey));
    if (result.state === "success") await fetchTaggedEntries();
    return result;
  }

  async function untagEntry(uri: string, tagKey: TagKey): Promise<IdbResult<RemovedRecords>> {
    await initialize();
    const result = report(await IdbTaggedEntry.remove(uri, tagKey));
    if (result.state === "success") await fetchTaggedEntries();
    return result;
  }

  /**
   * Undoes a deletion (a tag with its entries, an entry: cf.
   * `IdbBookmarks.revive`).
   */
  async function revive(removed: RemovedRecords): Promise<IdbResult> {
    await initialize();
    const result = report(await IdbBookmarks.revive(removed));
    if (result.state === "success") {
      await Promise.all([fetchTags(), fetchTaggedEntries(), fetchStarredEntries(), refreshNewTagColor()]);
      // The excerpts of the entries brought back, if forgotten meanwhile.
      void fillExcerpts();
    }
    return result;
  }

  /**
   * Reloads the data from IndexedDB (e.g. changed by another tab).
   */
  async function refresh(): Promise<void> {
    await initialize();
    await Promise.all([fetchTags(), fetchTaggedEntries(), fetchStarredEntries(), refreshNewTagColor()]);
  }

  /**
   * Merges a state (imported, or from another device) into the stored
   * bookmarks (cf. `idb/merge.ts`).
   */
  async function mergeState(state: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    await initialize();
    const result = report(await IdbBookmarks.merge(state));
    if (result.state === "success" && result.data.changed) await refresh();
    return result;
  }

  /**
   * Merges the state of the locker the first time this device synchronizes
   * with a key (cf. `IdbBookmarks.join`).
   */
  async function joinState(state: BookmarksState): Promise<IdbResult<MergeOutcome>> {
    await initialize();
    const result = report(await IdbBookmarks.join(state));
    if (result.state === "success" && result.data.changed) await refresh();
    return result;
  }

  /**
   * The bookmarks as an exported file (cf. `idb/transfer.ts`).
   */
  async function exportBookmarks(): Promise<BookmarksFile> {
    const [state, excerpts] = await Promise.all([IdbBookmarks.getState(), IdbBookmarks.getExcerpts()]);
    return toBookmarksFile(state, { excerpts });
  }

  /**
   * The URIs the API does not know (e.g. an entry removed from the
   * dictionary): not asked again during the visit.
   */
  const unknownUris = new Set<string>();

  /**
   * The pending fetch of excerpts, shared by concurrent calls; asked again
   * meanwhile (e.g. after a merge), it makes another pass.
   */
  let filling: Promise<IdbResult<{ changed: boolean }>> | null = null;
  let fillAgain = false;
  // (A function: the flag is set by concurrent calls.)
  const askedAgain = (): boolean => fillAgain;

  /**
   * Fetches from the API the excerpts of the bookmarks that have none on this
   * device (e.g. received from another one, cf. `IdbExcerpt`), by
   * batches. Offline or on failure, it stops there: the next call (next
   * visit, next merge) tries again, and the bookmarks show their word
   * meanwhile.
   */
  async function fillExcerpts(): Promise<IdbResult<{ changed: boolean }>> {
    if (filling) {
      fillAgain = true;
      return filling;
    }
    filling = (async (): Promise<IdbResult<{ changed: boolean }>> => {
      let changed = false;
      do {
        fillAgain = false;
        const result = await fillExcerptsOnce();
        if (result.state === "error") return result;
        changed ||= result.data.changed;
      } while (askedAgain());
      return { state: "success", data: { changed } };
    })().finally(() => {
      filling = null;
    });
    return filling;
  }

  /**
   * A pass of `fillExcerpts`.
   */
  async function fillExcerptsOnce(): Promise<IdbResult<{ changed: boolean }>> {
    await initialize();
    const uris = (await IdbBookmarks.missingExcerpts()).filter(uri => !unknownUris.has(uri));
    const found = new Map<string, string>();
    for (let i = 0; i < uris.length; i += MAX_EXCERPTS_URIS) {
      try {
        const { data } = await $api<ApiResponse<ApiExcerptsData>>("entries/excerpts", {
          query: toApiQuery({ uris: uris.slice(i, i + MAX_EXCERPTS_URIS) }),
        });
        for (const { uri, word, excerpt, homonyms } of data.entries) {
          // As for a group of homonyms added on this device (cf. `Idb.buildIdbEntry`).
          const text = homonyms ? `${word} (v. les ${homonyms} entrées)` : excerpt;
          if (text) found.set(uri, text);
        }
        for (const uri of data.missing) unknownUris.add(uri);
      } catch {
        break;
      }
    }
    if (!found.size) return { state: "success", data: { changed: false } };

    const result = await IdbBookmarks.fillExcerpts(found);
    if (result.state === "success" && result.data.changed) await refresh();
    return result;
  }

  /**
   * What an import would leave out to keep within the limits (cf.
   * `fitImport`), to ask the user first.
   * @param text The content of the file.
   */
  async function previewImport(text: string): Promise<IdbResult<SkippedRecords>> {
    await initialize();
    return report(await attempt(async () => IdbBookmarks.previewRestore(parseBookmarksFile(text, await IdbBookmarks.referenceTime()))));
  }

  /**
   * Imports an exported file: its bookmarks are restored, even if deleted
   * since, without undoing later changes nor deleting anything (cf.
   * `IdbBookmarks.restore`); what would exceed the limits is left out (cf.
   * `fitImport`).
   * @param text The content of the file.
   */
  async function importBookmarks(text: string): Promise<IdbResult<MergeOutcome & { skipped: SkippedRecords }>> {
    await initialize();
    const parsed = report(await attempt(async () => parseBookmarksFile(text, await IdbBookmarks.referenceTime())));
    if (parsed.state === "error") return parsed;

    const result = report(await IdbBookmarks.restore(parsed.data));
    if (result.state === "success" && result.data.changed) await refresh();
    return result;
  }

  return {
    initialized,
    tags,
    taggedEntries,
    starredEntries,
    newTagColor,
    currentTagKey,
    currentTag,
    held,
    hold,
    isStarred,
    tagKeysOf,
    entriesOf,
    initialize,
    starEntry,
    unstarEntry,
    createTag,
    updateTag,
    pinTag,
    removeTag,
    revive,
    setCurrentTag,
    tagEntry,
    untagEntry,
    refresh,
    mergeState,
    joinState,
    exportBookmarks,
    previewImport,
    importBookmarks,
    fillExcerpts,
  };
});
