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
 * How often the bookmarks are synchronized while the bookmarks page is shown,
 * so that the changes made on the other devices appear without reloading it.
 */
const POLL_INTERVAL = 60_000;

/**
 * The bookmarks page: the only one polled (elsewhere, the other triggers are
 * enough, and a long reading would make useless requests).
 */
const BOOKMARKS_PATH = "/signets";

/**
 * Runs the synchronization of the bookmarks and of the preferences, if
 * enabled on this device: once the application is ready, every minute while
 * the bookmarks page is shown (and when arriving there), when the user comes
 * back to the page or the network comes back, and shortly after each change
 * of a type synchronized (cf. `usePreferences` for the preferences), or right
 * away when the page is hidden, before the browser suspends it. It waits for
 * the end of the interactions that hold the bookmarks shown (cf.
 * `useBookmarksHold`).
 */
export default defineNuxtPlugin({
  name: "sync",
  dependsOn: ["bookmarks"],
  setup() {
    const bookmarksStore = useBookmarksStore();
    const syncStore = useSyncStore();
    const preferences = usePreferences();
    const router = useRouter();
    const onBookmarksPage = (): boolean => router.currentRoute.value.path === BOOKMARKS_PATH;
    const isStale = (delay: number): boolean => Date.now() - (syncStore.lastSyncedAt ?? 0) >= delay;

    onNuxtReady(async () => {
      await bookmarksStore.initialize();
      await syncStore.load();
      // The preferences synchronized that the cookie lacks (e.g. expired),
      // even offline.
      await syncStore.reconcilePreferences();
      if (syncStore.enabled) void syncStore.sync();
    });

    bookmarksStore.$onAction(({ name, after }) => {
      if (!LOCAL_CHANGES.has(name)) return;
      after((result: unknown) => {
        if ((result as { state?: string } | undefined)?.state === "success" && syncStore.syncedBookmarks) syncStore.schedule();
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
    // On the bookmarks page: when arriving there, then every minute.
    router.afterEach((to) => {
      if (to.path === BOOKMARKS_PATH && isStale(REVISIT_DELAY)) syncStore.schedule(0);
    });
    useIntervalFn(() => {
      if (!onBookmarksPage() || document.visibilityState !== "visible" || !navigator.onLine) return;
      if (isStale(POLL_INTERVAL - 1_000)) syncStore.schedule(0);
    }, POLL_INTERVAL);

    // The tabs tell each other when the settings change (key enabled,
    // disabled or deleted, types of data, latest synchronization): they load
    // them again, and the preferences (a synchronization may have applied
    // some received from another device).
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("bailly:sync");
    channel.onmessage = () => {
      preferences.reload();
      void syncStore.load();
    };
    watch(() => syncStore.settingsVersion, () => {
      channel.postMessage("settings");
    });
  },
});
