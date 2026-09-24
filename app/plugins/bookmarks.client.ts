import { Idb } from "~/idb";

/**
 * Configures IndexedDB and loads the bookmarks once the app is hydrated
 * (browser storage is not available on the server).
 */
export default defineNuxtPlugin({
  name: "bookmarks",
  dependsOn: ["pinia"],
  setup() {
    const { searchHistoryLength, tagMaxItems, maxTags } = useRuntimeConfig().public;
    Idb.configure({ searchHistoryLength, tagMaxItems, maxTags });

    const bookmarksStore = useBookmarksStore();
    onNuxtReady(() => bookmarksStore.initialize());
  },
});
