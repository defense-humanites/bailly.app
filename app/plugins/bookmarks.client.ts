import { Idb } from "~/idb";
import { requestPersistentStorage } from "~/utils/persistentStorage";

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
  "joinState",
  "importBookmarks",
]);

/**
 * The store actions that add bookmarks: after the first one, the persistent
 * storage is requested (cf. `utils/persistentStorage.ts`).
 */
const ADDITIONS = new Set(["starEntry", "createTag", "tagEntry", "mergeState", "joinState", "importBookmarks"]);

/**
 * Configures IndexedDB and loads the bookmarks once the app is hydrated
 * (browser storage is not available on the server). The tabs of the
 * application tell each other when they change the bookmarks, so that the
 * others reload them. Once the user adds bookmarks, the browser is asked to
 * keep them (persistent storage).
 */
export default defineNuxtPlugin({
  name: "bookmarks",
  dependsOn: ["pinia"],
  setup() {
    const { searchHistoryLength, tagMaxItems, maxTags } = useRuntimeConfig().public;
    Idb.configure({ searchHistoryLength, tagMaxItems, maxTags });

    const bookmarksStore = useBookmarksStore();
    onNuxtReady(() => bookmarksStore.initialize());

    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("bailly:bookmarks");
    if (channel) channel.onmessage = () => void bookmarksStore.refresh();

    bookmarksStore.$onAction(({ name, after }) => {
      if (!MUTATIONS.has(name)) return;
      after((result: unknown) => {
        const outcome = result as { state?: string; data?: { changed?: boolean } } | undefined;
        if (outcome?.state !== "success" || outcome.data?.changed === false) return;
        channel?.postMessage("changed");
        if (ADDITIONS.has(name)) void requestPersistentStorage();
      });
    });
  },
});
