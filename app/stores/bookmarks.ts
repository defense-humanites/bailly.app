import { defineStore } from "pinia";
import {
  type IdbResponse,
  IdbStarred,
  IdbTaggedEntry,
  type IdbEntry,
  type IdbEntryCreation,
  type IdbTagCreation,
  type IdbTagged,
  type IdbTagWithKey,
} from "~/idb";
import { IdbTags, type TagColorKey } from "../idb/IdbTags";

const errorToast = (message: string): void => {
  useToast().add({
    title: message,
    icon: "i-heroicons-exclamation-circle",
    color: "error",
  });
};

/**
 * The pending initialization, shared by concurrent or repeated calls (e.g.
 * after a hot module replacement).
 */
let initialization: Promise<void> | undefined;

const sortEntries = <T extends IdbEntry[]>(entries: T): T => {
  // Difference between 'grc' and 'el-polyton'?
  const collator = new Intl.Collator("grc");
  return entries.sort((a, b) => collator.compare(a.word, b.word));
};

/**
 * A store for bookmarks-related data (e.g. favorites, tags).
 * @remarks This store centralizes data stored permanently in the browser storage (IndexedDB and LocaleStorage).
 */
export const useBookmarksStore = defineStore("bookmarks", {
  state: () => ({
    /**
     * A boolean representing the state of the store.
     */
    initialized: false,
    /**
     * List of existing tags.
     */
    tags: [] as IdbTagWithKey[],
    /**
     * The active tag, on which to perform actions if no other tag is explicitly chosen.
     */
    currentTag: null as IdbTagWithKey | null,
    /**
     * Entries linked to tags.
     */
    taggedEntries: [] as IdbTagged[],
    /**
     * Entries marked as favorites.
     */
    starredEntries: [] as IdbEntry[],
    /**
     * The color to use when creating a new tag.
     * @remarks The color should be inferred from those already used.
     */
    newTagColor: undefined as TagColorKey | undefined,
  }),
  actions: {
    /**
     * Initializes the bookmarks store by fetching data stored in IndexedDB.
     */
    async initialize(): Promise<void> {
      initialization ??= (async () => {
        await this.fetchTags();
        await this.fetchTaggedEntries();
        await this.fetchStarredEntries();
        this.newTagColor = await IdbTags.pickColor();

        this.initialized = true;
      })();

      await initialization;
    },
    /**
     * Fetches the starred entries from IndexedDB.
     */
    async fetchStarredEntries(): Promise<void> {
      this.starredEntries = await IdbStarred.getAll();
    },
    /**
     * Fetches the tags from IndexedDB and refreshes the current tag.
     */
    async fetchTags(): Promise<void> {
      this.tags = await IdbTags.getAll({
        orderBy: "position",
      });
      this.currentTag = await IdbTags.getCurrent();
    },
    /**
     * Fetches the tagged entries from IndexedDB, then sorts them.
     */
    async fetchTaggedEntries(): Promise<void> {
      this.taggedEntries = sortEntries(
        await IdbTaggedEntry.getAll(),
      );
    },
    /**
     * Adds an entry to the starred entries.
     * @param entry An entry.
     * @returns A response containing the starred entry data or an error message.
     */
    async starEntry(entry: IdbEntryCreation): Promise<IdbResponse<IdbEntry>> {
      const response = await IdbStarred.add(entry);

      switch (response.state) {
        case "success":
          await this.fetchStarredEntries();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Removes an entry from the starred entries.
     * @param uri An entry URI.
     */
    async unstarEntry(uri: string): Promise<IdbResponse> {
      const response = await IdbStarred.remove(uri);

      switch (response.state) {
        case "success":
          await this.fetchStarredEntries();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Creates a new tag.
     * @param data An object containing at least a tag name.
     * @returns A response containing the new tag data or an error message.
     */
    async createTag(data: IdbTagCreation): Promise<IdbResponse<IdbTagWithKey>> {
      const response = await IdbTags.add(data);

      switch (response.state) {
        case "success":
          this.newTagColor = await IdbTags.pickColor();
          await this.fetchTags();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Updates a tag.
     * @param key The tag key.
     * @param data An object containing at least a tag name.
     * @returns A response containing the updated tag data or an error message.
     */
    async updateTag(
      key: number,
      data: IdbTagCreation,
    ): Promise<IdbResponse<IdbTagWithKey>> {
      const response = await IdbTags.update(key, data);

      switch (response.state) {
        case "success":
          if (this.newTagColor === response.data.color) {
            this.newTagColor = await IdbTags.pickColor();
          }
          await this.fetchTags();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Reorder tags.
     * @param orderedKeys The sorted tag keys.
     * @param setFirstAsCurrent A boolean representing whether the new first tag must be marked as the new current tag.
     */
    async reorderTags(
      orderedKeys: number[],
      setFirstAsCurrent: boolean = true,
    ): Promise<void> {
      const response = await IdbTags.reorder(orderedKeys, {
        setFirstAsCurrent,
      });

      switch (response.state) {
        case "success":
          await this.fetchTags();
          break;
        case "error":
          errorToast(response.message);
          break;
      }
    },
    /**
     * Removes a tag (and detaches its entries).
     * @param key The tag key.
     */
    async removeTag(key: number): Promise<IdbResponse> {
      const response = await IdbTags.remove(key);

      switch (response.state) {
        case "success":
          await this.fetchTags();
          await this.fetchTaggedEntries();
          this.newTagColor = await IdbTags.pickColor();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Adds an entry to a tag.
     * @param entry An entry.
     * @param tagKey The tag key.
     * @returns A response containing the tagged entry data or an error message.
     */
    async tagEntry(
      entry: IdbEntryCreation,
      tagKey: number,
    ): Promise<IdbResponse<IdbTagged>> {
      const response = await IdbTaggedEntry.add(entry, tagKey);

      switch (response.state) {
        case "success":
          await this.fetchTaggedEntries();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
    /**
     * Removes an entry linked to a tag.
     * @param uri The entry URI.
     * @param tagKey The tag key.
     */
    async untagEntry(uri: string, tagKey: number): Promise<IdbResponse> {
      const response = await IdbTaggedEntry.remove(uri, tagKey);

      switch (response.state) {
        case "success":
          await this.fetchTaggedEntries();
          break;
        case "error":
          errorToast(response.message);
          break;
      }

      return response;
    },
  },
});
