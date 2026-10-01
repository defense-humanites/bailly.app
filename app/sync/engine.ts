import { MAX_LOCKER_BLOB_LENGTH } from "#shared/utils/sync";
import { canonical, compact, emptyState, TOMBSTONE_MAX_AGE, withoutTombstones, type BookmarksState } from "~/idb/merge";
import { exportState } from "~/idb/transfer";
import { decryptText, encryptText, type SyncCredentials } from "./crypto";
import { bookmarksSection, knownSections, parseLocker, readBookmarksSection, serializeLocker, type LockerSections } from "./locker";
import { EMPTY_LOCKER, fetchLocker, storeLocker, SyncTimeoutError } from "./lockerClient";

export type SyncDependencies = {
  /**
   * Reads the stored bookmarks.
   */
  readState: () => Promise<BookmarksState>;
  /**
   * Merges a state into the stored bookmarks.
   * @returns The merged state.
   */
  mergeState: (state: BookmarksState) => Promise<BookmarksState>;
  /**
   * Merges a state into the stored bookmarks the first time this device
   * synchronizes with a key (cf. `joinRecords`), forgetting this device's
   * earlier deletions (cf. `IdbBookmarks.join`).
   * @returns The merged state.
   */
  joinState?: (state: BookmarksState) => Promise<BookmarksState>;
  /**
   * The reference time for the stamps received (cf.
   * `IdbBookmarks.referenceTime`); by default, this device's time.
   */
  referenceTime?: () => Promise<number>;
  fetch?: typeof fetch;
};

export type SyncOptions = {
  /**
   * Whether this device synchronizes with this key for the first time
   * (joined, or enabled again): its earlier deletions do not apply to the
   * bookmarks that exist online.
   */
  first?: boolean;
  /**
   * Cancels the synchronization: the pending requests are aborted, and
   * nothing is merged or written afterwards.
   */
  signal?: AbortSignal;
  /**
   * Called once the locker has been merged into the stored bookmarks.
   */
  onMerged?: () => void;
  /**
   * Called once this device has filled again a locker the server had emptied.
   */
  onRefilled?: () => void;
  /**
   * Whether to only receive: the locker is merged here, nothing is sent
   * (e.g. while the daily budget is spent, cf. `SyncQuotaError`).
   */
  readOnly?: boolean;
  /**
   * Receives the time of the server (cf. `LockerRequestOptions`).
   */
  onServerTime?: (time: number) => void;
};

const MAX_ATTEMPTS = 5;

/**
 * The bookmarks are too large for a locker, even without their tombstones.
 */
export class SyncTooLargeError extends Error {
  constructor() {
    super("Vos signets sont trop volumineux pour être synchronisés : supprimez-en quelques-uns.");
    this.name = "SyncTooLargeError";
  }
}

/**
 * Brought together with the locker, the bookmarks would exceed the limits:
 * nothing is merged nor written, until the user makes room on this device.
 */
export class SyncLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncLimitError";
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How long the tombstones are kept in a locker, the longest first: if the
 * content is too large, they are forgotten sooner (at worst, a device that
 * has not synchronized since may bring back a deleted bookmark).
 */
const TOMBSTONE_AGES = [TOMBSTONE_MAX_AGE, 30 * DAY, 7 * DAY, 0];

/**
 * The content of the locker for a state, within the size a locker accepts:
 * beyond, the older tombstones of the bookmarks are left out first, then the
 * sections this version does not know (so that they never prevent the
 * bookmarks from synchronizing).
 * @param maxLength The largest content (cf. `MAX_LOCKER_BLOB_LENGTH`).
 * @param sections The other sections of the locker, as read (kept as is).
 * @throws {SyncTooLargeError} If the bookmarks are too large, even without
 * their tombstones.
 */
export async function lockerBlob(
  state: BookmarksState,
  credentials: SyncCredentials,
  maxLength: number = MAX_LOCKER_BLOB_LENGTH,
  sections: LockerSections = {},
): Promise<string> {
  const known = knownSections(sections);
  const candidates = Object.keys(known).length < Object.keys(sections).length ? [sections, known] : [sections];
  for (const others of candidates) {
    for (const maxAge of TOMBSTONE_AGES) {
      const content = serializeLocker({ ...others, bookmarks: bookmarksSection(compact(state, maxAge)) });
      const blob = await encryptText(content, credentials);
      if (blob.length <= maxLength) return blob;
    }
  }
  throw new SyncTooLargeError();
}

/**
 * Whether two states hold the same bookmarks, as synchronized.
 */
const sameBookmarks = (a: BookmarksState, b: BookmarksState): boolean =>
  canonical(exportState(a)) === canonical(exportState(b));

/**
 * Synchronizes the bookmarks with the locker: reads it, merges it into the
 * stored bookmarks, then writes the result back if it differs, at the version
 * read. If another device wrote in the meantime, starts over (the merge is
 * a CRDT merge: nothing is lost, whatever the order).
 * @returns The version of the locker, once in sync.
 * @throws {LockerDeletedError} If a device deleted the locker.
 * @throws {SyncNetworkError} If the server cannot be reached.
 * @throws {SyncTooLargeError} If the bookmarks are too large for a locker.
 */
export async function synchronize(
  credentials: SyncCredentials,
  deps: SyncDependencies,
  { first = false, signal, onMerged, onRefilled, onServerTime, readOnly = false }: SyncOptions = {},
): Promise<number> {
  const merge = first && deps.joinState ? deps.joinState : deps.mergeState;
  const requestOptions = { fetch: deps.fetch, signal, onServerTime };
  const checkCancelled = (): void => {
    if (signal?.aborted) throw new SyncTimeoutError();
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const locker = await fetchLocker(credentials, requestOptions);

    let state: BookmarksState;
    let version: number;
    // The sections of the locker, as read: those of the other types are
    // written back as they are.
    let sections: LockerSections = {};
    if (locker && locker !== EMPTY_LOCKER) {
      sections = parseLocker(await decryptText(locker.blob, credentials));
      const remote = readBookmarksSection(sections, deps.referenceTime ? await deps.referenceTime() : Date.now());
      checkCancelled();
      state = await merge(remote);
      onMerged?.();
      if (sameBookmarks(state, remote) || readOnly) return locker.version;
      version = locker.version;
    } else {
      // Not created yet, or emptied (or deleted) after a long idle period:
      // (re)filled with this device's bookmarks. The first time with this key,
      // without its earlier deletions (cf. `joinState`): the other devices'
      // bookmarks are not online to protect them.
      if (readOnly) return 0;
      state = first ? withoutTombstones(await deps.readState()) : await deps.readState();
      version = 0;
    }

    const blob = await lockerBlob(state, credentials, MAX_LOCKER_BLOB_LENGTH, sections);
    checkCancelled();
    const result = await storeLocker(credentials, version, blob, requestOptions);
    if (result.state === "written") {
      if (!locker || locker === EMPTY_LOCKER) {
        // Once written, the earlier deletions are forgotten here too (a
        // deletion made during this synchronization with them, if any). A
        // failure changes nothing for the other devices: the locker, written,
        // counts.
        if (first && deps.joinState) {
          await deps.joinState(emptyState()).catch((e: unknown) => {
            console.error("The earlier deletions could not be forgotten", e);
          });
        }
        if (locker === EMPTY_LOCKER) onRefilled?.();
      }
      return result.version;
    }
  }

  throw new Error("La synchronisation n'a pas abouti : trop de modifications simultanées.");
}
