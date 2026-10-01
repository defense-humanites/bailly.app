import { emptyState, type BookmarksState } from "~/idb/merge";
import { boundPreferenceRecords, validatePreferenceRecords, type PreferenceRecord } from "~/idb/preferenceRecords";
import { toBookmarksFile, validateState } from "~/idb/transfer";

/**
 * The content of a synchronization locker (once decrypted): an envelope of
 * sections, one per type of data (the bookmarks, the preferences…), each
 * synchronized on the devices that enabled it.
 *
 * - A section this version does not know (added by a later version) is kept
 *   as is: the devices write at the version they read (cf. `storeLocker`), so
 *   that copying it never overwrites a later write.
 * - Each section has its own version, raised by any change of its structure
 *   (e.g. a field added to its records): a device that does not know it
 *   keeps the section as is, and stops synchronizing that type only (cf.
 *   `SyncOutdatedError`).
 * - A missing section is empty (e.g. a key used for the preferences only).
 * - The envelope's own version only changes with these rules: a device that
 *   does not know it stops synchronizing altogether.
 */
export type LockerSections = Record<string, RawSection>;

/**
 * A section as read: its version, and its data (validated by the module of
 * its type, if this version knows it).
 */
export type RawSection = { version: number } & Record<string, unknown>;

export const LOCKER_FORMAT = "bailly-sync";
export const LOCKER_VERSION = 1;

/**
 * The most sections an envelope keeps (the known ones first): a bound
 * against an aberrant content (a bug, a forged locker), besides the size of
 * the locker (cf. `MAX_LOCKER_BLOB_LENGTH`).
 */
export const MAX_SECTIONS = 8;

/**
 * The types of data this version synchronizes, by section.
 */
export type SyncSection = "bookmarks" | "preferences";
export const KNOWN_SECTIONS: readonly SyncSection[] = ["bookmarks", "preferences"];

/**
 * The versions of the sections this version knows.
 */
export const SECTION_VERSIONS: Record<SyncSection, number> = {
  bookmarks: 1,
  preferences: 1,
};

/**
 * The content of the locker cannot be read: not an envelope of this
 * application, or one of a later version.
 */
export class SyncFormatError extends Error {
  constructor(message = "Vos données en ligne sont illisibles pour cette version de Bailly.app.") {
    super(message);
    this.name = "SyncFormatError";
  }
}

/**
 * A section was written by a later version of the application: this type
 * of data no longer synchronizes on this device until the page is reloaded
 * (the section is kept as is meanwhile).
 */
export class SyncOutdatedError extends Error {
  readonly section: SyncSection;

  constructor(section: SyncSection) {
    super(OUTDATED_MESSAGES[section]);
    this.name = "SyncOutdatedError";
    this.section = section;
  }
}

const OUTDATED_MESSAGES: Record<SyncSection, string> = {
  bookmarks: "Cette version de Bailly.app ne peut plus synchroniser vos signets : rechargez la page.",
  preferences: "Cette version de Bailly.app ne peut plus synchroniser vos préférences : rechargez la page.",
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isKnown = (name: string): name is SyncSection => (KNOWN_SECTIONS as readonly string[]).includes(name);

/**
 * Whether a value is a section: an object with a positive integer version.
 */
const isSection = (value: unknown): value is RawSection =>
  isObject(value) && Number.isSafeInteger(value.version) && (value.version as number) >= 1;

/**
 * Keeps at most `MAX_SECTIONS` sections: the known ones first, then the
 * others in the order of their names (the same on every device).
 */
function boundSections(sections: LockerSections): LockerSections {
  const names = Object.keys(sections).sort((a, b) => {
    if (isKnown(a) !== isKnown(b)) return isKnown(a) ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return Object.fromEntries(names.slice(0, MAX_SECTIONS).map(name => [name, sections[name]!]));
}

/**
 * Reads the content of a locker.
 * @returns Its sections (the invalid ones left out).
 * @throws {SyncFormatError} If it is not an envelope this version can read.
 */
export function parseLocker(text: string): LockerSections {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SyncFormatError();
  }
  if (!isObject(data) || data.format !== LOCKER_FORMAT || !Number.isSafeInteger(data.version) || !isObject(data.sections)) {
    throw new SyncFormatError();
  }
  if ((data.version as number) > LOCKER_VERSION) {
    throw new SyncFormatError("Vos données en ligne ont été enregistrées par une version plus récente de Bailly.app : rechargez la page.");
  }

  const sections = Object.entries(data.sections).filter((entry): entry is [string, RawSection] => isSection(entry[1]));
  return boundSections(Object.fromEntries(sections));
}

/**
 * The content of a locker for its sections.
 */
export function serializeLocker(sections: LockerSections): string {
  return JSON.stringify({ format: LOCKER_FORMAT, version: LOCKER_VERSION, sections: boundSections(sections) });
}

/**
 * The sections of the locker that this version knows (the others left out,
 * e.g. when the locker is too large).
 */
export function knownSections(sections: LockerSections): LockerSections {
  return Object.fromEntries(Object.entries(sections).filter(([name]) => isKnown(name)));
}

/**
 * Checks that this version can read a section, if present.
 * @returns The section, or `null` if missing.
 * @throws {SyncOutdatedError} If it was written by a later version.
 */
function readable(sections: LockerSections, name: SyncSection): RawSection | null {
  const section = sections[name];
  if (!section) return null;
  if (section.version > SECTION_VERSIONS[name]) throw new SyncOutdatedError(name);
  return section;
}

/**
 * The bookmarks of the locker (an empty state if it has none).
 * @param now The reference time for the stamps too far in the future (cf.
 * `IdbBookmarks.referenceTime`).
 * @throws {SyncOutdatedError} If the section was written by a later version.
 * @throws {IdbError} If the section holds no valid bookmarks.
 */
export function readBookmarksSection(sections: LockerSections, now: number = Date.now()): BookmarksState {
  const section = readable(sections, "bookmarks");
  return section ? validateState(section.state, now) : emptyState();
}

/**
 * The section of the bookmarks: their recent tombstones included, so that
 * the deletions reach the other devices.
 */
export function bookmarksSection(state: BookmarksState): RawSection {
  return { version: SECTION_VERSIONS.bookmarks, state: toBookmarksFile(state, { tombstones: true }).state };
}

/**
 * The records of the preferences in the locker (validated and bounded, cf.
 * `validatePreferenceRecords`; none if it has none).
 * @param now The reference time for the stamps too far in the future.
 * @throws {SyncOutdatedError} If the section was written by a later version.
 */
export function readPreferencesSection(sections: LockerSections, now: number = Date.now()): PreferenceRecord[] {
  const section = readable(sections, "preferences");
  return section ? validatePreferenceRecords(section.records, now) : [];
}

/**
 * The section of the preferences.
 */
export function preferencesSection(records: PreferenceRecord[]): RawSection {
  return { version: SECTION_VERSIONS.preferences, records: boundPreferenceRecords(records) };
}
