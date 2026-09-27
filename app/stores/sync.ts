import { defineStore } from "pinia";
import { IdbBookmarks, Idb, IdbError, IdbMetaKey, type IdbResult, type IdbSyncConfig } from "~/idb";
import type { BookmarksState, LimitExcess } from "~/idb/merge";
import { fromBase64url, toBase64url } from "~/sync/base64url";
import { deriveCredentials, type SyncCredentials } from "~/sync/crypto";
import { synchronize, SyncLimitError, SyncTooLargeError, type SyncOptions } from "~/sync/engine";
import {
  fetchLocker,
  LockerDeletedError,
  removeLocker,
  SyncBusyError,
  SyncNetworkError,
  SyncTimeoutError,
} from "~/sync/lockerClient";

export type SyncStatus = "idle" | "syncing" | "error";

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
 * A store for the online synchronization of the bookmarks (cf. `app/sync/`):
 * the key of this device (if enabled), the state of the synchronization, and
 * the actions to enable, join, run and disable it.
 * @remarks Loaded and run by `plugins/sync.client.ts`. The key is kept in
 * IndexedDB (`IdbMetaKey.Sync`), next to the bookmarks it synchronizes.
 */
export const useSyncStore = defineStore("sync", () => {
  const bookmarksStore = useBookmarksStore();

  /**
   * Whether the settings have been loaded from IndexedDB.
   */
  const loaded = ref(false);
  /**
   * Whether the synchronization is enabled on this device.
   */
  const enabled = ref(false);
  const status = ref<SyncStatus>("idle");
  /**
   * The latest error, explained to the user.
   */
  const error = ref<string | null>(null);
  const lastSyncedAt = ref<number | null>(null);
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
   * Explains the limits a merge would exceed, and what to remove on this
   * device (which always suffices: the bookmarks online keep within them).
   * @param first Whether the key is being enabled (then retried by the user).
   */
  function describeExcesses(excesses: LimitExcess[], first: boolean): string {
    const { maxTags, tagMaxItems } = Idb.config;
    const parts = excesses.slice(0, 3).map((excess) => {
      if (excess.kind === "tags") {
        return `vous auriez ${excess.count} étiquettes (${maxTags} au plus) : supprimez-en au moins ${excess.count - maxTags}`;
      }
      const over = excess.count - tagMaxItems;
      return excess.tag === null
        ? `les favoris compteraient ${excess.count} entrées (${tagMaxItems} au plus) : retirez-en au moins ${over}`
        : `l'étiquette « ${excess.tag} » compterait ${excess.count} entrées (${tagMaxItems} au plus) : retirez-en au moins ${over}`;
    });
    if (excesses.length > parts.length) parts.push("d'autres limites sont aussi dépassées");
    // Otherwise, the window adds that the changes will be sent.
    return `Réunis avec ceux de vos autres appareils, vos signets dépasseraient les limites. Sur cet appareil, ${parts.join(" ; ")}.`
      + (first ? " Réessayez ensuite." : "");
  }

  /**
   * Forgets the key on this device (the bookmarks stay, here and online).
   */
  async function forget(): Promise<void> {
    await Idb.writeMeta(IdbMetaKey.Sync, undefined);
    await setConfig(null);
    status.value = "idle";
    settingsChanged();
  }

  /**
   * Runs the engine once with credentials, the tabs taking turns (Web Locks).
   * @returns The error, if it failed.
   */
  async function attempt(creds: SyncCredentials, options: Omit<SyncOptions, "signal"> = {}): Promise<unknown> {
    // A synchronization that takes too long is cancelled: its requests (and
    // its wait for the lock) are aborted, and nothing is merged or written
    // afterwards.
    const controller = new AbortController();
    const run = async (): Promise<unknown> => {
      try {
        await synchronize(creds, {
          readState: () => IdbBookmarks.getState(),
          mergeState: state => mergeRemote(state),
          joinState: state => mergeRemote(state, true),
        }, { ...options, signal: controller.signal });
        return null;
      } catch (e: unknown) {
        return e;
      }
    };

    const locked = (typeof navigator !== "undefined" && "locks" in navigator
      ? navigator.locks.request("bailly:bookmarks-sync", { signal: controller.signal }, run)
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
  function describe(e: unknown): string {
    if (e instanceof LockerDeletedError) return `${e.message} Vos signets restent sur cet appareil.`;
    if (e instanceof SyncNetworkError || e instanceof SyncTooLargeError || e instanceof SyncLimitError || e instanceof IdbError) {
      return e.message;
    }
    console.error(e);
    return "La synchronisation a échoué. Vos signets restent sur cet appareil.";
  }

  async function runOnce(): Promise<void> {
    if (!config || !credentials) return;
    const current = config;
    status.value = "syncing";
    error.value = null;

    const failure = await attempt(credentials);
    // Disabled (or replaced) meanwhile: the outcome no longer concerns it.
    if (config !== current) return;
    if (!failure) {
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
  }

  // (Asserted: set and cleared by concurrent calls.)
  let running = null as Promise<void> | null;
  let again = false;

  /**
   * Synchronizes now (once the synchronization in progress, if any, is over).
   * @returns Whether it succeeded.
   */
  async function sync(): Promise<boolean> {
    if (!enabled.value) return false;
    if (running) {
      again = true;
      await running;
      return status.value === "idle";
    }

    /**
     * Whether a synchronization was requested meanwhile (then cleared).
     */
    const takeAgain = (): boolean => {
      const value = again;
      again = false;
      return value;
    };

    again = false;
    running = (async () => {
      do {
        await runOnce();
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
    void sync();
  }

  /**
   * Synchronizes with a key, then keeps it on this device: only once the
   * first synchronization succeeded, so that a failure leaves the device as
   * it was (e.g. with its former key).
   * @returns The error, explained to the user, if it failed.
   */
  async function activate(secret: Uint8Array<ArrayBuffer>): Promise<IdbResult> {
    clearTimeout(timer);
    const previousStatus = status.value;
    status.value = "syncing";

    // Once the online bookmarks have been merged here, the device has joined,
    // even if sending its own ones fails: the key is kept, and the sending
    // retried.
    const progress = { merged: false };
    const failure = await attempt(await deriveCredentials(secret), {
      first: true,
      onMerged: () => {
        progress.merged = true;
      },
    });
    if (failure && !progress.merged) {
      status.value = previousStatus;
      return { state: "error", message: describe(failure) };
    }

    const value: IdbSyncConfig = { secret: toBase64url(secret), lastSyncedAt: failure ? null : Date.now() };
    await Idb.writeMeta(IdbMetaKey.Sync, value);
    await setConfig(value);
    settingsChanged();
    if (failure) {
      status.value = "error";
      error.value = `Vos signets en ligne ont été ajoutés à cet appareil, mais l'envoi des siens n'a pas abouti : nouvel essai dans quelques secondes. (${describe(failure)})`;
      schedule(BUSY_DELAY);
    } else {
      status.value = "idle";
      error.value = null;
    }
    return { state: "success", data: undefined };
  }

  /**
   * Whether this device synchronizes with a key.
   */
  function hasKey(secret: Uint8Array): boolean {
    return config?.secret === toBase64url(secret);
  }

  /**
   * Enables the synchronization with a new key (this device's bookmarks are
   * the first to be sent).
   */
  async function enable(): Promise<IdbResult> {
    return activate(crypto.getRandomValues(new Uint8Array(16)));
  }

  /**
   * Joins the synchronization of another device, with its key: its bookmarks
   * and this device's are merged. The key replaces this device's, if any.
   * @param key The 12 words of the key, or the secret itself (from a link).
   */
  async function join(key: string[] | Uint8Array<ArrayBuffer>): Promise<IdbResult> {
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

    // Already this device's key: a synchronization is enough.
    if (hasKey(secret)) {
      await sync();
      return { state: "success", data: undefined };
    }

    // A key that no device uses is most likely mistyped (a new locker is only
    // created by `enable`).
    try {
      if (!(await fetchLocker(await deriveCredentials(secret), { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT) }))) {
        return { state: "error", message: "Aucun signet n'est synchronisé avec cette clé : vérifiez-la." };
      }
    } catch (e: unknown) {
      if (e instanceof LockerDeletedError) {
        return { state: "error", message: "Cette clé a été désactivée : activez la synchronisation avec une nouvelle clé." };
      }
      return { state: "error", message: describe(e) };
    }

    return activate(secret);
  }

  /**
   * Disables the synchronization on this device (the bookmarks stay, here
   * and online for the other devices), after a last synchronization, so that
   * the latest changes are not lost (not waiting more than a few seconds,
   * e.g. offline).
   */
  async function disable(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (enabled.value) {
      await Promise.race([sync(), new Promise((resolve) => {
        setTimeout(resolve, DISABLE_DELAY);
      })]);
    }
    error.value = null;
    await forget();
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
    lastSyncedAt,
    settingsVersion,
    supported,
    load,
    sync,
    schedule,
    flush,
    enable,
    join,
    disable,
    deleteRemote,
    words,
    link,
    hasKey,
  };
});
