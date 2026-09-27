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
 * How long after a synchronization the return to the page triggers another.
 */
const REVISIT_DELAY = 10_000;

/**
 * How often the bookmarks are synchronized while the page is shown, so that
 * the changes made on the other devices appear without reloading it.
 */
const POLL_INTERVAL = 60_000;

/**
 * Runs the synchronization of the bookmarks, if enabled on this device: once
 * the application is ready, every minute while the page is shown, when the
 * user comes back to the page or the network comes back, and shortly after
 * each change (or right away when the page is hidden, before the browser
 * suspends it). It waits for the end of the interactions that hold the
 * bookmarks shown (cf. `useBookmarksHold`).
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
    // Back to the window (e.g. from another application, the page having
    // stayed visible).
    useEventListener(window, "focus", () => {
      if (Date.now() - (syncStore.lastSyncedAt ?? 0) > REVISIT_DELAY) syncStore.schedule(0);
    });
    useIntervalFn(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (Date.now() - (syncStore.lastSyncedAt ?? 0) >= POLL_INTERVAL - 1_000) syncStore.schedule(0);
    }, POLL_INTERVAL);

    // The tabs tell each other when the settings change (key enabled,
    // disabled or deleted, latest synchronization).
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("bailly:bookmarks-sync");
    channel.onmessage = () => void syncStore.load();
    watch(() => syncStore.settingsVersion, () => {
      channel.postMessage("settings");
    });
  },
});
