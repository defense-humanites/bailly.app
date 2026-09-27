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
import { parseBookmarksFile, toBookmarksFile, type BookmarksFile } from "~/idb/transfer";

const collator = new Intl.Collator("grc");

/**
 * Sorts entries alphabetically (Greek collation).
 */
const sortEntries = <T extends IdbEntry>(entries: T[]): T[] =>
  entries.sort((a, b) => collator.compare(a.word, b.word));

/**
 * A store for bookmarks-related data (favorites, tags and tagged entries).
 * @remarks The store is the source of truth for the components: it mirrors
 * the data stored in IndexedDB, and keeps the key of the current tag in
 * `localStorage`. It is initialized on the client (cf. `plugins/bookmarks.client.ts`).
 */
export const useBookmarksStore = defineStore("bookmarks", () => {
  const toast = useToast();

  /**
   * A boolean representing whether the data has been loaded from IndexedDB.
   */
  const initialized = ref(false);
  /**
   * List of existing tags, sorted by position.
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

  async function fetchStarredEntries(): Promise<void> {
    starredEntries.value = await IdbStarred.getAll();
  }

  /**
   * Fetches the tags; if the current tag no longer exists, the first tag
   * becomes the current one.
   * @remarks A current tag stored before the migration to UUIDs (a numeric
   * key) is found by its former key.
   */
  async function fetchTags(): Promise<void> {
    tags.value = await IdbTags.getAll();
    if (currentTag.value) return;

    const legacyCurrentTag = tags.value.find(
      tag => tag.legacyKey !== undefined && String(tag.legacyKey) === currentTagKey.value,
    );
    currentTagKey.value = (legacyCurrentTag ?? tags.value[0])?.key ?? null;
  }

  async function fetchTaggedEntries(): Promise<void> {
    taggedEntries.value = sortEntries(await IdbTaggedEntry.getAll());
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
   * cannot overwrite their result.
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
    })();

    await initialization;
  }

  async function starEntry(entry: IdbEntryCreation): Promise<IdbResult<IdbEntry>> {
    await initialize();
    const result = report(await IdbStarred.add(entry));
    if (result.state === "success") await fetchStarredEntries();
    return result;
  }

  async function unstarEntry(uri: string): Promise<IdbResult> {
    await initialize();
    const result = report(await IdbStarred.remove(uri));
    if (result.state === "success") await fetchStarredEntries();
    return result;
  }

  /**
   * Creates a tag, which becomes the current one.
   */
  async function createTag(data: IdbTagCreation): Promise<IdbResult<IdbTagWithKey>> {
    await initialize();
    const result = report(await IdbTags.add(data));
    if (result.state === "success") {
      currentTagKey.value = result.data.key;
      await Promise.all([fetchTags(), refreshNewTagColor()]);
    }
    return result;
  }

  async function updateTag(key: TagKey, data: IdbTagCreation): Promise<IdbResult<IdbTagWithKey>> {
    await initialize();
    const result = report(await IdbTags.update(key, data));
    if (result.state === "success") {
      await fetchTags();
      if (newTagColor.value === result.data.color) await refreshNewTagColor();
    }
    return result;
  }

  /**
   * Reorders the tags.
   * @param orderedKeys All the tag keys, in the new order.
   * @param setFirstAsCurrent Whether the new first tag becomes the current one.
   */
  async function reorderTags(
    orderedKeys: TagKey[],
    setFirstAsCurrent = true,
  ): Promise<IdbResult<IdbTagWithKey[]>> {
    await initialize();
    const result = report(await IdbTags.reorder(orderedKeys));
    if (result.state === "success" && setFirstAsCurrent && orderedKeys[0] !== undefined) {
      currentTagKey.value = orderedKeys[0];
    }
    // After a failure too: the tags shown are those stored.
    await fetchTags();
    return result;
  }

  /**
   * Removes a tag and detaches its entries.
   */
  async function removeTag(key: TagKey): Promise<IdbResult> {
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

  async function untagEntry(uri: string, tagKey: TagKey): Promise<IdbResult> {
    await initialize();
    const result = report(await IdbTaggedEntry.remove(uri, tagKey));
    if (result.state === "success") await fetchTaggedEntries();
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
    return toBookmarksFile(await IdbBookmarks.getState());
  }

  /**
   * What an import would leave out to keep within the limits (cf.
   * `fitImport`), to ask the user first.
   * @param text The content of the file.
   */
  async function previewImport(text: string): Promise<IdbResult<SkippedRecords>> {
    await initialize();
    return report(await attempt(async () => IdbBookmarks.previewRestore(parseBookmarksFile(text))));
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
    const parsed = report(await attempt(() => Promise.resolve().then(() => parseBookmarksFile(text))));
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
    isStarred,
    tagKeysOf,
    entriesOf,
    initialize,
    starEntry,
    unstarEntry,
    createTag,
    updateTag,
    reorderTags,
    removeTag,
    setCurrentTag,
    tagEntry,
    untagEntry,
    refresh,
    mergeState,
    joinState,
    exportBookmarks,
    previewImport,
    importBookmarks,
  };
});
