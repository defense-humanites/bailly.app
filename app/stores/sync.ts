import { defineStore } from "pinia";
import { IdbBookmarks, Idb, IdbError, IdbMetaKey, IdbPreferences, type IdbResult, type IdbSyncConfig } from "~/idb";
import type { BookmarksState, LimitExcess } from "~/idb/merge";
import { applicableValue, type PreferenceRecord } from "~/idb/preferenceRecords";
import { fromBase64url, toBase64url } from "~/sync/base64url";
import { deriveCredentials, type SyncCredentials } from "~/sync/crypto";
import { synchronize, SyncLimitError, SyncTooLargeError, type SyncDependencies, type SyncOptions } from "~/sync/engine";
import { SyncFormatError, SyncOutdatedError } from "~/sync/locker";
import {
  fetchLocker,
  LockerDeletedError,
  removeLocker,
  SyncBusyError,
  SyncNetworkError,
  SyncQuotaError,
  SyncTimeoutError,
} from "~/sync/lockerClient";
import { SYNCABLE_PREFERENCES, type SyncablePreference } from "~/utils/preferences";

export type SyncStatus = "idle" | "syncing" | "error";

/**
 * The types of data a device synchronizes: its bookmarks, and some of its
 * preferences (cf. `SYNCABLE_PREFERENCES`).
 */
export type SyncSections = {
  bookmarks: boolean;
  preferences: SyncablePreference[];
};

/**
 * The types of data of a device's settings (written before the
 * synchronization of the preferences: the bookmarks only).
 */
export const sectionsOf = (config: IdbSyncConfig): SyncSections => ({
  bookmarks: config.bookmarks ?? true,
  preferences: SYNCABLE_PREFERENCES.filter(key => config.preferences?.includes(key)),
});

/**
 * Whether a device synchronizes nothing (then it forgets the key).
 */
const isEmpty = (sections: SyncSections): boolean => !sections.bookmarks && !sections.preferences.length;

/**
 * The delay before synchronizing a change (several changes in a row are
 * sent at once).
 */
const CHANGE_DELAY = 3_000;
/**
 * The delay before retrying when the server refuses too many requests (the
 * rate limiting rule blocks for 10 seconds).
 */
const BUSY_DELAY = 15_000;
/**
 * The longest a synchronization may take before it is reported as failed.
 */
const ATTEMPT_TIMEOUT = 30_000;
/**
 * How long a cancelled synchronization may take to stop.
 */
const ABORT_GRACE = 1_000;
/**
 * The longest the last synchronization before disabling may delay it.
 */
const DISABLE_DELAY = 5_000;
/**
 * The gap between this device's clock and the server's beyond which the user
 * is warned (half the drift that the devices tolerate in the stamps).
 */
const CLOCK_TOLERANCE = 12 * 60 * 60 * 1000;

/**
 * A store for the online synchronization of the bookmarks and of the
 * preferences (cf. `app/sync/`): the key of this device (if enabled), the
 * types of data it synchronizes, the state of the synchronization, and the
 * actions to enable, join, run and disable it.
 * @remarks Loaded and run by `plugins/sync.client.ts`. The key is kept in
 * IndexedDB (`IdbMetaKey.Sync`), next to the bookmarks it synchronizes.
 */
export const useSyncStore = defineStore("sync", () => {
  const bookmarksStore = useBookmarksStore();
  const preferences = usePreferences();

  /**
   * Whether the settings have been loaded from IndexedDB.
   */
  const loaded = ref(false);
  /**
   * Whether the synchronization is enabled on this device.
   */
  const enabled = ref(false);
  /**
   * Whether this device synchronizes its bookmarks.
   */
  const syncedBookmarks = ref(false);
  /**
   * The preferences this device synchronizes (none: not synchronized).
   */
  const syncedPreferences = ref<SyncablePreference[]>([]);
  /**
   * The sections the locker held when last read (e.g. to tell what deleting
   * it would delete).
   */
  const remoteSections = ref<string[]>([]);
  const status = ref<SyncStatus>("idle");
  /**
   * The latest error, explained to the user.
   */
  const error = ref<string | null>(null);
  const lastSyncedAt = ref<number | null>(null);
  /**
   * Whether the latest error waits for the user (e.g. the limits would be
   * exceeded), rather than resolving itself (e.g. the network).
   */
  const errorNeedsAction = ref(false);
  /**
   * How far the server's time is ahead of this device's (ms), as of the
   * latest request.
   */
  const clockSkew = ref(0);
  /**
   * Whether this device's clock seems wrong: its changes (or those of the
   * other devices) could then be ignored (cf. `MAX_FUTURE_DRIFT`).
   */
  const clockWrong = computed(() => Math.abs(clockSkew.value) > CLOCK_TOLERANCE);
  /**
   * Incremented when this tab changes the settings (key, latest
   * synchronization), so that the other tabs are told (cf.
   * `plugins/sync.client.ts`).
   */
  const settingsVersion = ref(0);
  const settingsChanged = (): void => {
    settingsVersion.value++;
  };
  /**
   * Whether the browser can synchronize: the cryptography of the browsers
   * (Web Crypto) is only available in secure contexts (HTTPS).
   */
  const supported = computed(() => typeof globalThis.crypto !== "undefined" && "subtle" in globalThis.crypto);

  let config: IdbSyncConfig | null = null;
  let credentials: SyncCredentials | null = null;

  async function setConfig(value: IdbSyncConfig | null): Promise<void> {
    config = value;
    credentials = value ? await deriveCredentials(fromBase64url(value.secret)) : null;
    enabled.value = value !== null;
    lastSyncedAt.value = value?.lastSyncedAt ?? null;
    const sections = value ? sectionsOf(value) : { bookmarks: false, preferences: [] };
    syncedBookmarks.value = sections.bookmarks;
    syncedPreferences.value = sections.preferences;
    if (!value) remoteSections.value = [];
  }

  /**
   * Loads the settings (again, e.g. changed by another tab).
   */
  async function load(): Promise<void> {
    await setConfig((await Idb.readMeta(IdbMetaKey.Sync)) ?? null);
    if (!enabled.value) status.value = "idle";
    loaded.value = true;
  }

  /**
   * Merges the state of the locker into the stored bookmarks.
   * @param first Whether this device synchronizes with this key for the
   * first time (cf. `joinRecords`).
   */
  async function mergeRemote(state: BookmarksState, first = false): Promise<BookmarksState> {
    const result = first ? await bookmarksStore.joinState(state) : await bookmarksStore.mergeState(state);
    if (result.state === "error") throw new IdbError(result.message);
    if (result.data.excesses.length) throw new SyncLimitError(describeExcesses(result.data.excesses, first));
    return result.data.state;
  }

  /**
   * Merges the records of the preferences received into this device's, then
   * applies the values that win (and that this version knows), without
   * stamping them again: they keep the stamps of their changes. A value kept
   * in IndexedDB but missing from the cookie (e.g. expired) is applied again
   * too.
   * @param keys The preferences this device synchronizes.
   * @returns This device's records of these preferences, merged.
   */
  async function mergePreferences(received: PreferenceRecord[], keys: readonly SyncablePreference[]): Promise<PreferenceRecord[]> {
    const merged = await IdbPreferences.merge(received);
    for (const key of keys) {
      const record = merged.find(candidate => candidate.key === key);
      if (!record) continue;
      const value = applicableValue({ ...record, key });
      if (value !== undefined && value !== preferences.preference(key).value) preferences.set({ [key]: value }, { stamp: false });
    }
    return merged;
  }

  /**
   * Explains the limits a merge would exceed, and what to remove on this
   * device (cf. `describeLimitExcesses`).
   * @param first Whether the key is being enabled (then retried by the user).
   */
  function describeExcesses(excesses: LimitExcess[], first: boolean): string {
    return describeLimitExcesses(excesses, Idb.config, {
      lead: "Réunis avec ceux de vos autres appareils, vos signets dépasseraient les limites.",
      ending: first ? "Réessayez ensuite." : "La synchronisation reprendra ensuite.",
    });
  }

  /**
   * Forgets the key on this device (the bookmarks stay, here and online).
   */
  async function forget(): Promise<void> {
    await Idb.writeMeta(IdbMetaKey.Sync, undefined);
    await setConfig(null);
    clearQuota();
    status.value = "idle";
    settingsChanged();
  }

  /**
   * How the engine reaches the types of data this device synchronizes.
   */
  function dependencies(sections: SyncSections): SyncDependencies {
    const keys = sections.preferences;
    return {
      bookmarks: sections.bookmarks
        ? {
            readState: () => IdbBookmarks.getState(),
            mergeState: state => mergeRemote(state),
            joinState: state => mergeRemote(state, true),
            referenceTime: () => IdbBookmarks.referenceTime(),
          }
        : undefined,
      preferences: keys.length
        ? {
            keys,
            readRecords: () => IdbPreferences.getRecords(),
            mergeRecords: records => mergePreferences(records, keys),
          }
        : undefined,
    };
  }

  /**
   * Runs the engine once with credentials, the tabs taking turns (Web Locks).
   * @param sections The types of data to synchronize.
   * @returns The error, if it failed.
   */
  async function attempt(creds: SyncCredentials, sections: SyncSections, options: Omit<SyncOptions, "signal"> = {}): Promise<unknown> {
    // A synchronization that takes too long is cancelled: its requests (and
    // its wait for the lock) are aborted, and nothing is merged or written
    // afterwards.
    const controller = new AbortController();
    const run = async (): Promise<unknown> => {
      try {
        await synchronize(creds, dependencies(sections), {
          ...options,
          signal: controller.signal,
          onServerTime: (time) => {
            clockSkew.value = time - Date.now();
          },
          onSections: (names) => {
            remoteSections.value = names;
          },
        });
        return null;
      } catch (e: unknown) {
        return e;
      }
    };

    const locked = (typeof navigator !== "undefined" && "locks" in navigator
      ? navigator.locks.request("bailly:sync", { signal: controller.signal }, run)
      : run()
    ).catch(() => new SyncTimeoutError()); // The wait for the lock, aborted.

    // In case a step cannot be aborted (e.g. IndexedDB blocked by another
    // tab), the user is not left waiting either.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<unknown>((resolve) => {
      timeout = setTimeout(() => {
        controller.abort();
        setTimeout(() => {
          resolve(new SyncTimeoutError());
        }, ABORT_GRACE);
      }, ATTEMPT_TIMEOUT);
    });

    try {
      return await Promise.race([locked, expired]);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * An error of the synchronization, explained to the user.
   */
  /**
   * Whether an error waits for the user (rather than resolving itself).
   */
  function needsAction(e: unknown): boolean {
    return e instanceof SyncLimitError || e instanceof SyncTooLargeError || e instanceof SyncOutdatedError || e instanceof SyncFormatError;
  }

  function describe(e: unknown): string {
    if (e instanceof LockerDeletedError) return `${e.message} Vos signets restent sur cet appareil.`;
    if (
      e instanceof SyncNetworkError || e instanceof SyncTooLargeError || e instanceof SyncLimitError
      || e instanceof SyncFormatError || e instanceof SyncOutdatedError || e instanceof IdbError
    ) {
      return e.message;
    }
    console.error(e);
    return "La synchronisation a échoué. Vos signets restent sur cet appareil.";
  }

  async function runOnce(force = false): Promise<void> {
    if (!config || !credentials) return;
    const current = config;
    // While the daily budget is spent, the changes of the other devices are
    // still received; this device's wait (unless asked by the user).
    const readOnly = !force && Date.now() < quotaUntil;
    status.value = "syncing";
    error.value = null;

    const failure = await attempt(credentials, sectionsOf(current), { readOnly });
    // Disabled (or replaced) meanwhile: the outcome no longer concerns it.
    if (config !== current) return;
    errorNeedsAction.value = needsAction(failure);
    if (!failure && readOnly) {
      status.value = "error";
      error.value = quotaMessage;
      schedule(Math.max(0, quotaUntil - Date.now()));
      return;
    }
    if (!failure) {
      clearQuota();
      config = { ...config, lastSyncedAt: Date.now() };
      await Idb.writeMeta(IdbMetaKey.Sync, config);
      lastSyncedAt.value = config.lastSyncedAt;
      status.value = "idle";
      settingsChanged();
      return;
    }

    if (failure instanceof LockerDeletedError) {
      await forget();
      error.value = describe(failure);
      return;
    }
    if (failure instanceof SyncBusyError) schedule(BUSY_DELAY);
    status.value = "error";
    error.value = describe(failure);
    if (failure instanceof SyncQuotaError) waitForQuota(failure);
  }

  /**
   * Until when the automatic synchronizations only receive, the daily budget
   * being spent (cf. `SyncQuotaError`): they send again then, or when asked
   * by the user.
   */
  let quotaUntil = 0;
  /**
   * The error shown meanwhile.
   */
  let quotaMessage: string | null = null;

  /**
   * Waits for the daily budget (the error being shown).
   */
  function waitForQuota(failure: SyncQuotaError): void {
    quotaUntil = Date.now() + failure.retryAfter * 1000;
    quotaMessage = error.value;
    schedule(failure.retryAfter * 1000);
  }

  function clearQuota(): void {
    quotaUntil = 0;
    quotaMessage = null;
  }

  // (Asserted: set and cleared by concurrent calls.)
  let running = null as Promise<void> | null;
  let again = false;
  let forceAgain = false;

  /**
   * Whether a synchronization waits for the end of an interaction (cf.
   * `bookmarksStore.hold`).
   */
  let deferred = false;

  watch(() => bookmarksStore.held, (held) => {
    if (held || !deferred) return;
    deferred = false;
    schedule(0);
  });

  /**
   * Synchronizes now (once the synchronization in progress, if any, is over).
   * @param options.force Whether to synchronize even during an interaction
   * that holds the bookmarks shown (e.g. asked by the user, or before the
   * page is suspended); otherwise, it waits for its end.
   * @returns Whether it succeeded.
   */
  async function sync({ force = false }: { force?: boolean } = {}): Promise<boolean> {
    if (!enabled.value) return false;
    if (!force && bookmarksStore.held) {
      deferred = true;
      return status.value === "idle";
    }
    if (running) {
      again = true;
      // A forced request makes the next run forced (e.g. sending while the
      // current one only receives, cf. `quotaUntil`).
      forceAgain ||= force;
      await running;
      return status.value === "idle";
    }

    /**
     * Whether a synchronization was requested meanwhile (then cleared), and
     * whether it is forced.
     */
    let forced = force;
    const takeAgain = (): boolean => {
      const value = again;
      forced = forceAgain;
      again = false;
      forceAgain = false;
      return value;
    };

    again = false;
    forceAgain = false;
    running = (async () => {
      do {
        await runOnce(forced);
      } while (takeAgain());
    })();

    try {
      await running;
    } finally {
      running = null;
    }
    return status.value === "idle";
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Synchronizes after a delay (e.g. after a change).
   */
  function schedule(delay: number = CHANGE_DELAY): void {
    if (!enabled.value) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void sync();
    }, delay);
  }

  /**
   * Synchronizes now if a synchronization is scheduled (e.g. when the page is
   * hidden, before the browser suspends it).
   */
  function flush(): void {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    void sync({ force: true });
  }

  /**
   * Synchronizes with a key, then keeps it on this device: only once the
   * first synchronization succeeded, so that a failure leaves the device as
   * it was (e.g. with its former key, or without its bookmarks synchronized).
   * @param sections The types of data to synchronize with it.
   * @returns The error, explained to the user, if it failed; `emptied`: the
   * server had emptied the locker (the key is valid, but only this device's
   * data are online now).
   */
  async function activate(secret: Uint8Array<ArrayBuffer>, sections: SyncSections): Promise<IdbResult<{ emptied: boolean }>> {
    clearTimeout(timer);
    const previousStatus = status.value;
    status.value = "syncing";

    // Once the online data have been merged here, the device has joined,
    // even if sending its own fails: the key is kept, and the sending
    // retried.
    const progress = { merged: false, refilled: false };
    const failure = await attempt(await deriveCredentials(secret), sections, {
      first: sections.bookmarks,
      onMerged: () => {
        progress.merged = true;
      },
      onRefilled: () => {
        progress.refilled = true;
      },
    });
    if (failure && !progress.merged) {
      status.value = previousStatus;
      return { state: "error", message: describe(failure) };
    }

    const value: IdbSyncConfig = {
      secret: toBase64url(secret),
      lastSyncedAt: failure ? null : Date.now(),
      bookmarks: sections.bookmarks,
      preferences: [...sections.preferences],
    };
    await Idb.writeMeta(IdbMetaKey.Sync, value);
    await setConfig(value);
    // A budget spent with a former key no longer concerns this one.
    clearQuota();
    settingsChanged();
    errorNeedsAction.value = needsAction(failure);
    const received = sections.bookmarks
      ? "Vos signets en ligne ont été ajoutés à cet appareil, mais l'envoi des siens n'a pas abouti"
      : "Vos préférences en ligne ont été appliquées sur cet appareil, mais l'envoi des siennes n'a pas abouti";
    if (failure && (errorNeedsAction.value || failure instanceof SyncQuotaError)) {
      // To be done by the user, or tomorrow: no retry in a few seconds.
      status.value = "error";
      error.value = `${received}. ${describe(failure)}`;
      if (failure instanceof SyncQuotaError) waitForQuota(failure);
    } else if (failure) {
      status.value = "error";
      error.value = `${received} : nouvel essai dans quelques secondes. (${describe(failure)})`;
      schedule(BUSY_DELAY);
    } else {
      status.value = "idle";
      error.value = null;
    }
    return { state: "success", data: { emptied: progress.refilled } };
  }

  /**
   * Whether this device synchronizes with a key.
   */
  function hasKey(secret: Uint8Array): boolean {
    return config?.secret === toBase64url(secret);
  }

  /**
   * Enables the synchronization with a new key (this device's data are the
   * first to be sent).
   * @param sections The types of data to synchronize.
   */
  async function enable(sections: SyncSections): Promise<IdbResult> {
    const result = await activate(crypto.getRandomValues(new Uint8Array(16)), sections);
    return result.state === "success" ? { state: "success", data: undefined } : result;
  }

  /**
   * Joins the synchronization of another device, with its key: its data and
   * this device's are merged. The key replaces this device's, if any; if it
   * is already this device's, the types of data are added to those it
   * synchronizes.
   * @param key The 12 words of the key, or the secret itself (from a link).
   * @param sections The types of data to synchronize.
   * @returns `emptied`: the server had emptied the locker (the key is valid,
   * but only this device's data are online now).
   */
  async function join(key: string[] | Uint8Array<ArrayBuffer>, sections: SyncSections): Promise<IdbResult<{ emptied: boolean }>> {
    let secret: Uint8Array<ArrayBuffer>;
    if (Array.isArray(key)) {
      const { wordsToSecret, SyncKeyError } = await import("~/sync/key");
      try {
        secret = wordsToSecret(key);
      } catch (e: unknown) {
        if (e instanceof SyncKeyError) return { state: "error", message: e.message };
        throw e;
      }
    } else {
      secret = key;
    }

    // Already this device's key: the types of data are added.
    if (config && hasKey(secret)) {
      const current = sectionsOf(config);
      return setSections({
        bookmarks: current.bookmarks || sections.bookmarks,
        preferences: SYNCABLE_PREFERENCES.filter(name => current.preferences.includes(name) || sections.preferences.includes(name)),
      });
    }

    // A key that no device uses is most likely mistyped (a new locker is only
    // created by `enable`; an emptied one still exists).
    try {
      if (!(await fetchLocker(await deriveCredentials(secret), { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT) }))) {
        return { state: "error", message: "Cette clé n'est utilisée par aucun appareil : vérifiez-la." };
      }
    } catch (e: unknown) {
      if (e instanceof LockerDeletedError) {
        return { state: "error", message: "Cette clé a été désactivée : activez la synchronisation avec une nouvelle clé." };
      }
      return { state: "error", message: describe(e) };
    }

    return activate(secret, sections);
  }

  /**
   * A last synchronization, so that the latest changes are not lost (not
   * waiting more than a few seconds, e.g. offline).
   */
  async function lastSync(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    await Promise.race([sync({ force: true }), new Promise((resolve) => {
      setTimeout(resolve, DISABLE_DELAY);
    })]);
  }

  /**
   * Changes the types of data this device synchronizes with its key: the
   * bookmarks, once added, are joined as with a new key (cf. `activate`);
   * nothing left, the key is forgotten (cf. `disable`).
   * @returns The error, explained to the user, if the first synchronization
   * of a type added failed.
   */
  async function setSections(sections: SyncSections): Promise<IdbResult<{ emptied: boolean }>> {
    if (!config) return { state: "error", message: "La synchronisation n'est pas activée sur cet appareil." };
    if (isEmpty(sections)) {
      await disable();
      return { state: "success", data: { emptied: false } };
    }

    const current = sectionsOf(config);
    if (sections.bookmarks && !current.bookmarks) return activate(fromBase64url(config.secret), sections);

    // The bookmarks no longer synchronized: their latest changes sent first.
    if (current.bookmarks && !sections.bookmarks) await lastSync();
    // Disabled (or deleted) meanwhile.
    const latest = config as IdbSyncConfig | null;
    if (!latest) return { state: "success", data: { emptied: false } };

    const value: IdbSyncConfig = { ...latest, bookmarks: sections.bookmarks, preferences: [...sections.preferences] };
    await Idb.writeMeta(IdbMetaKey.Sync, value);
    await setConfig(value);
    settingsChanged();

    // Preferences added: synchronized now.
    if (sections.preferences.some(key => !current.preferences.includes(key)) && !(await sync({ force: true }))) {
      return { state: "error", message: error.value ?? "La synchronisation a échoué." };
    }
    return { state: "success", data: { emptied: false } };
  }

  /**
   * Stops synchronizing a type of data on this device (it stays online for
   * the other devices), or all of them: the key is then forgotten, after a
   * last synchronization.
   * @param section The type of data; all if omitted (or if it was the only
   * one).
   */
  async function disable(section?: "bookmarks" | "preferences"): Promise<void> {
    if (section && config) {
      const current = sectionsOf(config);
      const next = section === "bookmarks" ? { ...current, bookmarks: false } : { ...current, preferences: [] };
      if (!isEmpty(next)) {
        await setSections(next);
        return;
      }
    }
    if (enabled.value) await lastSync();
    error.value = null;
    await forget();
  }

  /**
   * To be called when the user changes a preference (stamped): synchronized
   * shortly, if this device synchronizes it.
   */
  function preferencesChanged(keys: string[]): void {
    if (keys.some(key => (syncedPreferences.value as string[]).includes(key))) schedule();
  }

  /**
   * Deletes the bookmarks from the server: the synchronization stops on every
   * device (their bookmarks stay on each of them).
   */
  async function deleteRemote(): Promise<IdbResult> {
    if (!credentials) return { state: "success", data: undefined };
    try {
      await removeLocker(credentials, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT) });
    } catch (e: unknown) {
      if (!(e instanceof LockerDeletedError)) {
        return { state: "error", message: e instanceof Error ? e.message : String(e) };
      }
    }
    clearTimeout(timer);
    timer = undefined;
    error.value = null;
    await forget();
    return { state: "success", data: undefined };
  }

  /**
   * The 12 words of the key.
   */
  async function words(): Promise<string[]> {
    if (!config) return [];
    const { secretToWords } = await import("~/sync/key");
    return secretToWords(fromBase64url(config.secret));
  }

  /**
   * A link that enables the synchronization on another device (e.g. through
   * a QR code); the key is in the fragment, which browsers do not send.
   */
  function link(origin: string): string | null {
    return config ? `${origin}/signets#sync=${config.secret}` : null;
  }

  return {
    loaded,
    enabled,
    status,
    error,
    errorNeedsAction,
    clockWrong,
    clockSkew,
    lastSyncedAt,
    settingsVersion,
    supported,
    syncedBookmarks,
    syncedPreferences,
    remoteSections,
    load,
    sync,
    schedule,
    flush,
    enable,
    join,
    setSections,
    disable,
    preferencesChanged,
    deleteRemote,
    words,
    link,
    hasKey,
  };
});
