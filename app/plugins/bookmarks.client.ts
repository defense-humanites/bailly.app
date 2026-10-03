import { Idb, IdbBookmarks } from "~/idb";
import { requestPersistentStorage } from "~/utils/persistentStorage";

/**
 * The store actions that change the bookmarks.
 */
const MUTATIONS = new Set([
  "starEntry",
  "unstarEntry",
  "createTag",
  "updateTag",
  "pinTag",
  "removeTag",
  "revive",
  "tagEntry",
  "untagEntry",
  "mergeState",
  "joinState",
  "importBookmarks",
  "fillExcerpts",
]);

/**
 * The store actions that may bring bookmarks without their excerpt (cf.
 * `IdbExcerpt`): the missing ones are then fetched.
 */
const MERGES = new Set(["mergeState", "joinState", "importBookmarks"]);

/**
 * The store actions that add bookmarks: after the first one, the persistent
 * storage is requested (cf. `utils/persistentStorage.ts`).
 */
const ADDITIONS = new Set(["starEntry", "createTag", "tagEntry", "revive", "mergeState", "joinState", "importBookmarks"]);

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
    const toast = useToast();
    /**
     * The toast asking to close the other tabs, removed once the database
     * is open.
     */
    let blockedToast: string | number | undefined;
    Idb.onBlocked(() => {
      blockedToast = toast.add({
        title: "Fermez les autres onglets de Bailly.app",
        description: "Vos signets passent à une nouvelle version : ils s'afficheront une fois les autres onglets fermés.",
        icon: "i-lucide-circle-alert",
        color: "warning",
        duration: 0,
      }).id;
    });

    const bookmarksStore = useBookmarksStore();
    onNuxtReady(async () => {
      await bookmarksStore.initialize();
      if (blockedToast !== undefined) toast.remove(blockedToast);
      // At each visit, the tombstones old enough are forgotten, and the
      // missing excerpts fetched.
      void IdbBookmarks.compact();
      void bookmarksStore.fillExcerpts();
    });

    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("bailly:bookmarks");
    // A change in another tab: reloaded, once the interaction in progress (if
    // any) is over (cf. `useBookmarksHold`).
    let refreshDeferred = false;
    if (channel) {
      channel.onmessage = () => {
        if (bookmarksStore.held) refreshDeferred = true;
        else void bookmarksStore.refresh();
      };
    }
    watch(() => bookmarksStore.held, (held) => {
      if (held || !refreshDeferred) return;
      refreshDeferred = false;
      void bookmarksStore.refresh();
    });

    bookmarksStore.$onAction(({ name, after }) => {
      if (!MUTATIONS.has(name)) return;
      after((result: unknown) => {
        const outcome = result as { state?: string; data?: { changed?: boolean } } | undefined;
        if (outcome?.state !== "success" || outcome.data?.changed === false) return;
        channel?.postMessage("changed");
        if (ADDITIONS.has(name)) void requestPersistentStorage();
        if (MERGES.has(name)) void bookmarksStore.fillExcerpts();
      });
    });
  },
});
