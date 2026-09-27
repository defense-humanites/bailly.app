import { Idb } from "~/idb";

/**
 * The store actions that change the bookmarks.
 */
const MUTATIONS = new Set([
  "starEntry",
  "unstarEntry",
  "createTag",
  "updateTag",
  "reorderTags",
  "removeTag",
  "tagEntry",
  "untagEntry",
  "mergeState",
]);

/**
 * Configures IndexedDB and loads the bookmarks once the app is hydrated
 * (browser storage is not available on the server). The tabs of the
 * application tell each other when they change the bookmarks, so that the
 * others reload them.
 */
export default defineNuxtPlugin({
  name: "bookmarks",
  dependsOn: ["pinia"],
  setup() {
    const { searchHistoryLength, tagMaxItems, maxTags } = useRuntimeConfig().public;
    Idb.configure({ searchHistoryLength, tagMaxItems, maxTags });

    const bookmarksStore = useBookmarksStore();
    onNuxtReady(() => bookmarksStore.initialize());

    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("bailly:bookmarks");
    channel.onmessage = () => void bookmarksStore.refresh();
    bookmarksStore.$onAction(({ name, after }) => {
      if (!MUTATIONS.has(name)) return;
      after((result: unknown) => {
        if ((result as { state?: string } | undefined)?.state === "success") channel.postMessage("changed");
      });
    });
  },
});
