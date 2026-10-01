import { MAX_LOCKER_BLOB_LENGTH } from "#shared/utils/sync";
import { canonical, compact, emptyState, TOMBSTONE_MAX_AGE, withoutTombstones, type BookmarksState, type LimitExcess } from "~/idb/merge";
import { mergePreferenceRecords, type PreferenceRecord } from "~/idb/preferenceRecords";
import { exportState } from "~/idb/transfer";
import type { SyncablePreference } from "~/utils/preferences";
import { decryptText, encryptText, type SyncCredentials } from "./crypto";
import {
  bookmarksSection,
  knownSections,
  parseLocker,
  preferencesSection,
  readBookmarksSection,
  readPreferencesSection,
  serializeLocker,
  type LockerSections,
  type SyncSection,
} from "./locker";
import { EMPTY_LOCKER, fetchLocker, storeLocker, SyncTimeoutError } from "./lockerClient";

/**
 * How this device keeps its bookmarks, if it synchronizes them.
 */
export type BookmarksDependencies = {
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
   * synchronizes them with a key (cf. `joinRecords`), forgetting this
   * device's earlier deletions (cf. `IdbBookmarks.join`).
   * @returns The merged state.
   */
  joinState?: (state: BookmarksState) => Promise<BookmarksState>;
};

/**
 * How this device keeps its preferences, if it synchronizes some.
 */
export type PreferencesDependencies = {
  /**
   * The preferences this device synchronizes: the records of the others are
   * passed on as they are.
   */
  keys: readonly SyncablePreference[];
  /**
   * Reads this device's records of these preferences.
   */
  readRecords: () => Promise<PreferenceRecord[]>;
  /**
   * Merges the records received (of these preferences only) into this
   * device's, and applies the values that win.
   * @returns This device's records of these preferences, merged.
   */
  mergeRecords: (records: PreferenceRecord[]) => Promise<PreferenceRecord[]>;
};

/**
 * The types of data this device synchronizes (at least one), and how.
 */
export type SyncDependencies = {
  bookmarks?: BookmarksDependencies;
  preferences?: PreferencesDependencies;
  /**
   * The reference time for the stamps received, the same for every type
   * (cf. `IdbBookmarks.referenceTime`: this device's clock, or the latest
   * stamp it observed); by default, this device's time.
   */
  referenceTime?: () => Promise<number>;
  fetch?: typeof fetch;
};

export type SyncOptions = {
  /**
   * Whether this device synchronizes its bookmarks with this key for the
   * first time (joined, or enabled again): its earlier deletions do not
   * apply to the bookmarks that exist online.
   */
  first?: boolean;
  /**
   * Cancels the synchronization: the pending requests are aborted, and
   * nothing is merged or written afterwards.
   */
  signal?: AbortSignal;
  /**
   * Called once the locker has been merged into the stored data, with the
   * types merged (some may have failed, cf. `SyncPartialError`).
   */
  onMerged?: (sections: SyncSection[]) => void;
  /**
   * Called once this device has filled again a locker the server had emptied.
   */
  onRefilled?: () => void;
  /**
   * Receives the sections the locker holds, once read (e.g. to tell what a
   * deletion of the locker would delete).
   */
  onSections?: (names: string[]) => void;
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
  /**
   * The limits exceeded, if known (e.g. to explain them otherwise).
   */
  readonly excesses: LimitExcess[];

  constructor(message: string, excesses: LimitExcess[] = []) {
    super(message);
    this.name = "SyncLimitError";
    this.excesses = excesses;
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
 * The content of the locker, within the size a locker accepts: beyond, the
 * older tombstones of the bookmarks are left out first, then the sections
 * this version does not know (so that they never prevent the bookmarks from
 * synchronizing).
 * @param state The bookmarks to write, if this device synchronizes them
 * (otherwise, their section is kept as read, among `sections`).
 * @param maxLength The largest content (cf. `MAX_LOCKER_BLOB_LENGTH`).
 * @param sections The other sections of the locker.
 * @throws {SyncTooLargeError} If the content is too large, even without the
 * tombstones of the bookmarks nor the unknown sections.
 */
export async function lockerBlob(
  state: BookmarksState | null,
  credentials: SyncCredentials,
  maxLength: number = MAX_LOCKER_BLOB_LENGTH,
  sections: LockerSections = {},
): Promise<string> {
  const known = knownSections(sections);
  const candidates = Object.keys(known).length < Object.keys(sections).length ? [sections, known] : [sections];
  for (const others of candidates) {
    for (const maxAge of state ? TOMBSTONE_AGES : [null]) {
      const content = serializeLocker(state && maxAge !== null ? { ...others, bookmarks: bookmarksSection(compact(state, maxAge)) } : others);
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
 * A type of data could not be merged with the locker (e.g. the limits would
 * be exceeded, or its section was written by a later version), while the
 * others were: its section stays as read online, and its error (`cause`) is
 * reported once the others are written.
 */
export class SyncPartialError extends Error {
  readonly section: SyncSection;

  constructor(section: SyncSection, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "SyncPartialError";
    this.section = section;
  }
}

/**
 * The outcome of merging one type of data with the locker: merged (`changed`:
 * to be written back), or not, its section then staying as read.
 */
type SectionOutcome = { section: SyncSection } & ({ state: "merged"; changed: boolean } | { state: "failed"; error: unknown });

/**
 * Synchronizes the types of data this device synchronizes with the locker:
 * reads it, merges each section into the stored data, then writes the result
 * back if it differs, at the version read; the sections of the other types
 * are written back as they are. If another device wrote in the meantime,
 * starts over (the merges are CRDT merges: nothing is lost, whatever the
 * order).
 * @returns The version of the locker, once in sync.
 * @throws {SyncPartialError} If a type could not be merged (or its data are
 * too large), the others being in sync: its section stays as read.
 * @throws {LockerDeletedError} If a device deleted the locker.
 * @throws {SyncNetworkError} If the server cannot be reached.
 * @throws {SyncTooLargeError} If the content is too large for a locker.
 */
export async function synchronize(
  credentials: SyncCredentials,
  deps: SyncDependencies,
  { first = false, signal, onMerged, onRefilled, onSections, onServerTime, readOnly = false }: SyncOptions = {},
): Promise<number> {
  const { bookmarks, preferences } = deps;
  const requestOptions = { fetch: deps.fetch, signal, onServerTime };
  const checkCancelled = (): void => {
    if (signal?.aborted) throw new SyncTimeoutError();
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const locker = await fetchLocker(credentials, requestOptions);
    // The locker with a content (not missing nor emptied).
    const found = locker && locker !== EMPTY_LOCKER ? locker : null;
    const exists = found !== null;
    // The sections of the locker, as read; those of the types merged here
    // are replaced below.
    const sections: LockerSections = found ? parseLocker(await decryptText(found.blob, credentials)) : {};
    onSections?.(Object.keys(sections));
    const now = deps.referenceTime ? await deps.referenceTime() : Date.now();
    checkCancelled();

    const outcomes: SectionOutcome[] = [];

    // The bookmarks.
    let state: BookmarksState | null = null;
    if (bookmarks && exists) {
      try {
        const remote = readBookmarksSection(sections, now);
        checkCancelled();
        state = await (first && bookmarks.joinState ? bookmarks.joinState(remote) : bookmarks.mergeState(remote));
        outcomes.push({ section: "bookmarks", state: "merged", changed: !sameBookmarks(state, remote) });
      } catch (e: unknown) {
        if (e instanceof SyncTimeoutError) throw e;
        state = null;
        outcomes.push({ section: "bookmarks", state: "failed", error: e });
      }
    } else if (bookmarks && !readOnly) {
      // Not created yet, or emptied (or deleted) after a long idle period:
      // (re)filled with this device's bookmarks. The first time with this key,
      // without its earlier deletions (cf. `joinState`): the other devices'
      // bookmarks are not online to protect them.
      state = first ? withoutTombstones(await bookmarks.readState()) : await bookmarks.readState();
      outcomes.push({ section: "bookmarks", state: "merged", changed: true });
    }

    // The preferences: those this device synchronizes are merged, the others
    // passed on.
    if (preferences) {
      try {
        const remote = readPreferencesSection(sections, now);
        const synced = new Set<string>(preferences.keys);
        checkCancelled();
        const local = exists
          ? await preferences.mergeRecords(remote.filter(record => synced.has(record.key)))
          : await preferences.readRecords();
        checkCancelled();
        const merged = mergePreferenceRecords(
          remote.filter(record => !synced.has(record.key)),
          local.filter(record => synced.has(record.key)),
        );
        const changed = canonical(merged) !== canonical(remote);
        if (changed) sections.preferences = preferencesSection(merged);
        outcomes.push({ section: "preferences", state: "merged", changed });
      } catch (e: unknown) {
        if (e instanceof SyncTimeoutError) throw e;
        outcomes.push({ section: "preferences", state: "failed", error: e });
      }
    }

    if (exists) onMerged?.(outcomes.filter(outcome => outcome.state === "merged").map(outcome => outcome.section));
    let failure = outcomes.find(outcome => outcome.state === "failed");
    const partial = (): SyncPartialError | null =>
      failure?.state === "failed" ? new SyncPartialError(failure.section, failure.error) : null;

    // Created even if empty (so that the other devices can join the key).
    const changed = !exists || outcomes.some(outcome => outcome.state === "merged" && outcome.changed);
    if (readOnly || !changed) {
      const error = partial();
      if (error) throw error;
      return found ? found.version : 0;
    }

    let blob: string;
    try {
      blob = await lockerBlob(state, credentials, MAX_LOCKER_BLOB_LENGTH, sections);
    } catch (e: unknown) {
      // Bookmarks too large: the preferences changed are written all the
      // same, the bookmarks staying as read online.
      if (!(e instanceof SyncTooLargeError) || !exists || state === null) throw e;
      const preferencesChanged = outcomes.some(outcome => outcome.section === "preferences" && outcome.state === "merged" && outcome.changed);
      if (!preferencesChanged) throw new SyncPartialError("bookmarks", e);
      blob = await lockerBlob(null, credentials, MAX_LOCKER_BLOB_LENGTH, sections);
      failure = { section: "bookmarks", state: "failed", error: e };
    }
    checkCancelled();
    const result = await storeLocker(credentials, found ? found.version : 0, blob, requestOptions);
    if (result.state === "written") {
      if (!exists) {
        // Once written, the earlier deletions are forgotten here too (a
        // deletion made during this synchronization with them, if any). A
        // failure changes nothing for the other devices: the locker, written,
        // counts.
        if (first && bookmarks?.joinState) {
          await bookmarks.joinState(emptyState()).catch((e: unknown) => {
            console.error("The earlier deletions could not be forgotten", e);
          });
        }
        if (locker === EMPTY_LOCKER) onRefilled?.();
      }
      const error = partial();
      if (error) throw error;
      return result.version;
    }
  }

  throw new Error("La synchronisation n'a pas abouti : trop de modifications simultanées.");
}
