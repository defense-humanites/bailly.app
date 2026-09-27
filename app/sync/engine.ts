import { canonical, type BookmarksState } from "~/idb/merge";
import { exportState, parseBookmarksFile, toBookmarksFile } from "~/idb/transfer";
import { decryptText, encryptText, type SyncCredentials } from "./crypto";
import { fetchLocker, storeLocker } from "./lockerClient";

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
  fetch?: typeof fetch;
};

const MAX_ATTEMPTS = 5;

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
 */
export async function synchronize(credentials: SyncCredentials, deps: SyncDependencies): Promise<number> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const locker = await fetchLocker(credentials, deps.fetch);

    let state: BookmarksState;
    let version: number;
    if (locker) {
      const remote = parseBookmarksFile(await decryptText(locker.blob, credentials));
      state = await deps.mergeState(remote);
      if (sameBookmarks(state, remote)) return locker.version;
      version = locker.version;
    } else {
      // Not created yet, or purged after a long idle period: (re)created
      // from this device's bookmarks.
      state = await deps.readState();
      version = 0;
    }

    const blob = await encryptText(JSON.stringify(toBookmarksFile(state)), credentials);
    const result = await storeLocker(credentials, version, blob, deps.fetch);
    if (result.state === "written") return result.version;
  }

  throw new Error("La synchronisation n'a pas abouti : trop de modifications simultanées.");
}
