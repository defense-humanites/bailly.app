/**
 * The activity of the synchronization, as shown (its window, the card of the
 * preferences page): when it last happened, whether it is running, and a
 * synchronization asked by the user with its outcome.
 */
export const useSyncActivity = () => {
  const syncStore = useSyncStore();
  const { status, lastSyncedAt } = storeToRefs(syncStore);

  const now = useNow({ interval: 30_000 });
  const relativeTime = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

  /**
   * When the latest synchronization happened, e.g. « il y a 5 minutes » (the
   * date beyond a day), updated as time goes by.
   */
  const lastSync = computed((): string | null => {
    if (!lastSyncedAt.value) return null;
    const minutes = Math.round((now.value.getTime() - lastSyncedAt.value) / 60_000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return relativeTime.format(-minutes, "minute");
    if (minutes < 24 * 60) return relativeTime.format(-Math.round(minutes / 60), "hour");
    return `le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(lastSyncedAt.value)}`;
  });

  /**
   * Whether a synchronization has been running for a moment: the short ones
   * (most of them) don't change the state shown.
   */
  const syncingShown = ref(false);
  let syncingTimer: ReturnType<typeof setTimeout> | undefined;
  watch(status, (value) => {
    clearTimeout(syncingTimer);
    if (value === "syncing") {
      syncingTimer = setTimeout(() => {
        syncingShown.value = true;
      }, 400);
    } else {
      syncingShown.value = false;
    }
  });

  /**
   * The outcome of a synchronization asked by the user, shown on its button:
   * running (at least a moment, even when it is quick), then done or failed
   * for a moment.
   */
  const manualSync = ref<"idle" | "running" | "done" | "failed">("idle");
  let manualSyncTimer: ReturnType<typeof setTimeout> | undefined;

  const syncNow = async (): Promise<void> => {
    clearTimeout(manualSyncTimer);
    manualSync.value = "running";
    const [ok] = await Promise.all([
      syncStore.sync({ force: true }),
      new Promise((resolve) => {
        setTimeout(resolve, 600);
      }),
    ]);
    manualSync.value = ok ? "done" : "failed";
    manualSyncTimer = setTimeout(() => {
      manualSync.value = "idle";
    }, 2_000);
  };

  onBeforeUnmount(() => {
    clearTimeout(syncingTimer);
    clearTimeout(manualSyncTimer);
  });

  return { lastSync, syncingShown, manualSync, syncNow };
};
