import { defineStore, skipHydrate } from "pinia";
import { LocalStorageKey } from "~/enums";
import {
  IdbStarred,
  IdbTaggedEntry,
  IdbTags,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbResult,
  type IdbTagCreation,
  type IdbTagged,
  type IdbTagWithKey,
  type TagColorKey,
} from "~/idb";

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
   * @remarks Stored under the same key as in the previous (Astro) application.
   * Not hydrated from the server, which cannot read `localStorage`.
   */
  const currentTagKey = skipHydrate(useLocalStorage<number | null>(
    LocalStorageKey.CurrentTagKey,
    null,
    {
      serializer: {
        read: (value: string) => (value ? Number(value) : null),
        write: (value: number | null) => String(value),
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
  const tagKeysOf = (uri: string): number[] =>
    taggedEntries.value.filter(entry => entry.uri === uri).map(entry => entry.tagKey);
  /**
   * The entries that belong to a tag.
   */
  const entriesOf = (tagKey: number): IdbTagged[] =>
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
   */
  async function fetchTags(): Promise<void> {
    tags.value = await IdbTags.getAll({ orderBy: "position" });
    if (!currentTag.value) currentTagKey.value = tags.value[0]?.key ?? null;
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

  async function updateTag(key: number, data: IdbTagCreation): Promise<IdbResult<IdbTagWithKey>> {
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
    orderedKeys: number[],
    setFirstAsCurrent = true,
  ): Promise<IdbResult<IdbTagWithKey[]>> {
    await initialize();
    const result = report(await IdbTags.reorder(orderedKeys));
    if (result.state === "success") {
      if (setFirstAsCurrent && orderedKeys[0] !== undefined) currentTagKey.value = orderedKeys[0];
      await fetchTags();
    }
    return result;
  }

  /**
   * Removes a tag and detaches its entries.
   */
  async function removeTag(key: number): Promise<IdbResult> {
    await initialize();
    const result = report(await IdbTags.remove(key));
    if (result.state === "success") {
      await Promise.all([fetchTags(), fetchTaggedEntries(), refreshNewTagColor()]);
    }
    return result;
  }

  function setCurrentTag(key: number): void {
    if (tags.value.some(tag => tag.key === key)) currentTagKey.value = key;
  }

  async function tagEntry(entry: IdbEntryCreation, tagKey: number): Promise<IdbResult<IdbTagged>> {
    await initialize();
    const result = report(await IdbTaggedEntry.add(entry, tagKey));
    if (result.state === "success") await fetchTaggedEntries();
    return result;
  }

  async function untagEntry(uri: string, tagKey: number): Promise<IdbResult> {
    await initialize();
    const result = report(await IdbTaggedEntry.remove(uri, tagKey));
    if (result.state === "success") await fetchTaggedEntries();
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
  };
});
