import { StorageKey } from "~/enums";
import { isTagSort, type TagSort } from "~/utils/tagSort";

/**
 * How the tags are sorted on the bookmarks page, kept on the device (local
 * storage; nothing is written until it is chosen). Read once the application
 * is hydrated: the server, which cannot read it, renders the default.
 */
export const useTagSort = () => useLocalStorage<TagSort>(StorageKey.TagSort, "name", {
  writeDefaults: false,
  initOnMounted: true,
  serializer: {
    read: (value: string) => (isTagSort(value) ? value : "name"),
    write: (value: TagSort) => value,
  },
});
