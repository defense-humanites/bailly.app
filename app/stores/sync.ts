import { defineStore } from "pinia";
import { IdbBookmarks, Idb, IdbMetaKey, type IdbResult, type IdbSyncConfig } from "~/idb";
import type { BookmarksState } from "~/idb/merge";
import { fromBase64url, toBase64url } from "~/sync/base64url";
import { deriveCredentials, type SyncCredentials } from "~/sync/crypto";
import { synchronize } from "~/sync/engine";
import { fetchLocker, LockerDeletedError, removeLocker, SyncBusyError, SyncNetworkError } from "~/sync/lockerClient";

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
   * Set while remote bookmarks are merged (the changes they bring must not
   * trigger another synchronization).
   */
  const applyingRemote = ref(false);
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

  async function mergeRemote(state: BookmarksState): Promise<BookmarksState> {
    applyingRemote.value = true;
    try {
      const result = await bookmarksStore.mergeState(state);
      if (result.state === "error") throw new Error(result.message);
      return result.data.state;
    } finally {
      applyingRemote.value = false;
    }
  }

  /**
   * Forgets the key on this device (the bookmarks stay, here and online).
   */
  async function forget(): Promise<void> {
    await Idb.writeMeta(IdbMetaKey.Sync, undefined);
    await setConfig(null);
    status.value = "idle";
  }

  async function runOnce(): Promise<void> {
    if (!config || !credentials) return;
    status.value = "syncing";
    error.value = null;
    try {
      await synchronize(credentials, { readState: () => IdbBookmarks.getState(), mergeState: mergeRemote });
      config = { ...config, lastSyncedAt: Date.now() };
      await Idb.writeMeta(IdbMetaKey.Sync, config);
      lastSyncedAt.value = config.lastSyncedAt;
      status.value = "idle";
    } catch (e: unknown) {
      if (e instanceof LockerDeletedError) {
        await forget();
        error.value = `${e.message} Vos signets restent sur cet appareil.`;
        return;
      }
      if (!(e instanceof SyncNetworkError)) console.error(e);
      if (e instanceof SyncBusyError) schedule(BUSY_DELAY);
      status.value = "error";
      error.value = e instanceof SyncNetworkError
        ? e.message
        : "La synchronisation a échoué. Vos signets restent sur cet appareil.";
    }
  }

  // (Asserted: set and cleared by concurrent calls.)
  let running = null as Promise<void> | null;
  let again = false;

  /**
   * Synchronizes now (once the synchronization in progress, if any, is over).
   * @remarks The tabs of the application take turns (Web Locks).
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
        if (typeof navigator !== "undefined" && "locks" in navigator) {
          await navigator.locks.request("bailly:bookmarks-sync", runOnce);
        } else {
          await runOnce();
        }
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

  async function activate(secret: Uint8Array): Promise<void> {
    const value: IdbSyncConfig = { secret: toBase64url(secret), lastSyncedAt: null };
    await Idb.writeMeta(IdbMetaKey.Sync, value);
    await setConfig(value);
    await sync();
  }

  /**
   * Enables the synchronization with a new key (this device's bookmarks are
   * the first to be sent).
   */
  async function enable(): Promise<boolean> {
    await activate(crypto.getRandomValues(new Uint8Array(16)));
    return status.value === "idle";
  }

  /**
   * Joins the synchronization of another device, with its key: its bookmarks
   * and this device's are merged.
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

    try {
      if (!(await fetchLocker(await deriveCredentials(secret)))) {
        return { state: "error", message: "Aucun signet n'est synchronisé avec cette clé : vérifiez-la." };
      }
    } catch (e: unknown) {
      if (e instanceof LockerDeletedError) {
        return { state: "error", message: "Cette clé a été désactivée : activez la synchronisation avec une nouvelle clé." };
      }
      return { state: "error", message: e instanceof Error ? e.message : String(e) };
    }

    await activate(secret);
    return { state: "success", data: undefined };
  }

  /**
   * Disables the synchronization on this device (the bookmarks stay, here
   * and online for the other devices).
   */
  async function disable(): Promise<void> {
    clearTimeout(timer);
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
      await removeLocker(credentials);
    } catch (e: unknown) {
      if (!(e instanceof LockerDeletedError)) {
        return { state: "error", message: e instanceof Error ? e.message : String(e) };
      }
    }
    await disable();
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
    applyingRemote,
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
  };
});
