/**
 * The store actions that change the bookmarks on this device.
 */
const LOCAL_CHANGES = new Set([
  "starEntry",
  "unstarEntry",
  "createTag",
  "updateTag",
  "reorderTags",
  "removeTag",
  "tagEntry",
  "untagEntry",
  "importBookmarks",
]);

/**
 * The store actions that change the synchronization settings.
 */
const SETTINGS_CHANGES = new Set(["enable", "join", "disable", "deleteRemote"]);

/**
 * How long after a synchronization the return to the page triggers another.
 */
const REVISIT_DELAY = 10_000;

/**
 * Runs the synchronization of the bookmarks, if enabled on this device: once
 * the application is ready, when the user comes back to the page or the
 * network comes back, and shortly after each change (or right away when the
 * page is hidden, before the browser suspends it).
 */
export default defineNuxtPlugin({
  name: "bookmarks-sync",
  dependsOn: ["bookmarks"],
  setup() {
    const bookmarksStore = useBookmarksStore();
    const syncStore = useSyncStore();

    onNuxtReady(async () => {
      await bookmarksStore.initialize();
      await syncStore.load();
      if (syncStore.enabled) void syncStore.sync();
    });

    bookmarksStore.$onAction(({ name, after }) => {
      if (!LOCAL_CHANGES.has(name)) return;
      after((result: unknown) => {
        if ((result as { state?: string } | undefined)?.state === "success") syncStore.schedule();
      });
    });

    useEventListener(document, "visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        syncStore.flush();
      } else if (Date.now() - (syncStore.lastSyncedAt ?? 0) > REVISIT_DELAY) {
        syncStore.schedule(0);
      }
    });
    useEventListener(window, "online", () => {
      syncStore.schedule(0);
    });

    // The tabs tell each other when the settings change.
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("bailly:bookmarks-sync");
    channel.onmessage = () => void syncStore.load();
    syncStore.$onAction(({ name, after }) => {
      if (!SETTINGS_CHANGES.has(name)) return;
      after(() => {
        channel.postMessage("settings");
      });
    });
  },
});
