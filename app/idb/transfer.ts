import { isStamp, stampTime } from "./clock";
import { IdbError } from "./Idb";
import { IdbTags } from "./IdbTags";
import {
  comparableTagName,
  compact,
  emptyState,
  mergeStates,
  type BookmarksState,
  type StarredRecord,
  type TaggedRecord,
  type TagOrder,
  type TagRecord,
  withoutTombstones,
} from "./merge";

/**
 * The bookmarks as exchanged outside of the browser: an exported file (the
 * existing bookmarks), and the content of the synchronized locker (with the
 * recent tombstones, so that deletions reach the other devices).
 */
export type BookmarksFile = {
  format: typeof BOOKMARKS_FILE_FORMAT;
  version: typeof BOOKMARKS_FILE_VERSION;
  /**
   * The date of the export (ISO 8601).
   */
  exportedAt: string;
  /**
   * The bookmarks. In an exported file, the entries also carry their
   * `excerpt` (if known), for the reader of the file.
   */
  state: BookmarksState;
};

export const BOOKMARKS_FILE_FORMAT = "bailly-bookmarks";
export const BOOKMARKS_FILE_VERSION = 1;

/**
 * The maximum number of records of a file (beyond the limits of the
 * application, with room for the tombstones).
 */
const MAX_RECORDS = 20_000;
/**
 * How far in the future a stamp may be (clocks drift): beyond, the record is
 * left out, so that a device with a wrong clock (or a forged file) cannot
 * move every device's clock into the future.
 */
export const MAX_FUTURE_DRIFT = 24 * 60 * 60 * 1000;
const MAX_STRING_LENGTH = 10_000;

/**
 * Prepares a state for the outside: without the tombstones old enough to be
 * forgotten, nor the former keys of the tags (only meaningful on this device).
 */
export function exportState(state: BookmarksState): BookmarksState {
  const compacted = compact(state);
  return {
    ...compacted,
    tags: compacted.tags.map(({ legacyKey: _legacyKey, ...tag }) => tag),
  };
}

/**
 * The bookmarks as a file.
 * @param options.tombstones Whether to keep the (recent) tombstones: needed
 * to synchronize, useless in an exported file (an import never deletes).
 * @param options.excerpts The excerpts known on this device (cf. `IdbExcerpt`),
 * given to the entries for the reader of an exported file (an import ignores
 * them; never in a locker).
 */
export function toBookmarksFile(
  state: BookmarksState,
  { now = new Date(), tombstones = false, excerpts }: { now?: Date; tombstones?: boolean; excerpts?: Map<string, string> } = {},
): BookmarksFile {
  const exported = exportState(state);
  const kept = tombstones ? exported : withoutTombstones(exported);
  const withExcerpt = <T extends TaggedRecord | StarredRecord>(record: T): T => {
    const excerpt = record.deleted ? undefined : excerpts?.get(record.uri);
    return excerpt ? { ...record, excerpt } : record;
  };
  return {
    format: BOOKMARKS_FILE_FORMAT,
    version: BOOKMARKS_FILE_VERSION,
    exportedAt: now.toISOString(),
    state: excerpts ? { ...kept, tagged: kept.tagged.map(withExcerpt), starred: kept.starred.map(withExcerpt) } : kept,
  };
}

/**
 * The name of an exported file, e.g. `bailly-signets-2026-09-27.json`.
 */
export function bookmarksFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `bailly-signets-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown, { required = false } = {}): value is string =>
  typeof value === "string" && value.length <= MAX_STRING_LENGTH && (!required || value.trim().length > 0);

/**
 * Whether a value is a stamp, not too far in the future.
 */
const isValidStamp = (value: unknown, now: number): value is string =>
  isStamp(value) && stampTime(value) <= now + MAX_FUTURE_DRIFT;

/**
 * The common fields of the records, if valid.
 */
function versioned(value: Record<string, unknown>, now: number): { updatedAt: string; deleted?: true } | null {
  if (!isValidStamp(value.updatedAt, now) || (value.deleted !== undefined && value.deleted !== true)) return null;
  return { updatedAt: value.updatedAt, ...(value.deleted ? { deleted: true as const } : {}) };
}

/**
 * A tag, if valid: a name is required, as when a tag is created on the device
 * (a deletion may have none).
 */
function validateTag(value: unknown, now: number): TagRecord | null {
  if (!isObject(value) || !isText(value.key, { required: true })) return null;
  const common = versioned(value, now);
  if (!common || !isText(value.name, { required: !common.deleted }) || !isValidStamp(value.createdAt, now)) return null;

  const name = value.name.trim();
  if (!common.deleted && comparableTagName(name) === "favoris") return null;

  return {
    key: value.key,
    name,
    description: isText(value.description) ? value.description : "",
    // A color unknown to this version of the application (e.g. added since):
    // the tag is kept, with a color it knows.
    color: IdbTags.isColorKey(value.color) ? value.color : IdbTags.colorKeys[0]!,
    createdAt: value.createdAt,
    ...common,
  };
}

/**
 * The entry fields of a record: a word is required, as when a bookmark is
 * created on the device (a deletion may have none).
 * @remarks The word is text, and shown as such (never as HTML). An excerpt,
 * if any (an exported file), is ignored: the excerpts shown come from the
 * dictionary (cf. `IdbExcerpt`).
 */
function validateEntry(value: Record<string, unknown>, deleted: boolean): { uri: string; word: string } | null {
  if (!isText(value.uri, { required: true }) || !isText(value.word, { required: !deleted })) return null;
  return { uri: value.uri, word: value.word };
}

function validateTagged(value: unknown, now: number): TaggedRecord | null {
  if (!isObject(value) || !isText(value.tagKey, { required: true })) return null;
  const common = versioned(value, now);
  const entry = common && validateEntry(value, Boolean(common.deleted));
  return common && entry ? { tagKey: value.tagKey, ...entry, ...common } : null;
}

function validateStarred(value: unknown, now: number): StarredRecord | null {
  if (!isObject(value)) return null;
  const common = versioned(value, now);
  const entry = common && validateEntry(value, Boolean(common.deleted));
  return common && entry ? { ...entry, ...common } : null;
}

function validateOrder(value: unknown, now: number): TagOrder | null {
  if (!isObject(value) || !isValidStamp(value.updatedAt, now) || !Array.isArray(value.keys)) return null;
  const keys = value.keys.filter((key): key is string => isText(key, { required: true }));
  return { keys: [...new Set(keys)], updatedAt: value.updatedAt };
}

/**
 * Validates a state from the outside (a file, another device): invalid
 * records are left out, rather than refusing everything.
 * @throws {IdbError} If the value is not a state at all, or too large.
 */
export function validateState(value: unknown, now: number = Date.now()): BookmarksState {
  if (!isObject(value) || !Array.isArray(value.tags) || !Array.isArray(value.tagged) || !Array.isArray(value.starred)) {
    throw new IdbError("Ce fichier ne contient pas de signets.");
  }
  if (value.tags.length + value.tagged.length + value.starred.length > MAX_RECORDS) {
    throw new IdbError("Ce fichier contient trop de signets.");
  }

  const keep = <T>(records: (T | null)[]): T[] => records.filter((record): record is T => record !== null);

  // Canonical form (duplicates merged).
  return mergeStates({
    tags: keep(value.tags.map(tag => validateTag(tag, now))),
    tagged: keep(value.tagged.map(record => validateTagged(record, now))),
    starred: keep(value.starred.map(record => validateStarred(record, now))),
    tagOrder: value.tagOrder === null || value.tagOrder === undefined ? null : validateOrder(value.tagOrder, now),
  }, emptyState());
}

/**
 * Reads an exported file.
 * @returns The state it contains.
 * @throws {IdbError} If the file is not a (supported) export of the bookmarks.
 */
/**
 * Parses and validates a file of bookmarks (an export, or a locker).
 * @param now The reference time for the stamps too far in the future (cf.
 * `IdbBookmarks.referenceTime`).
 */
export function parseBookmarksFile(text: string, now: number = Date.now()): BookmarksState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new IdbError("Ce fichier n'est pas un export de signets de Bailly.");
  }

  if (!isObject(data) || data.format !== BOOKMARKS_FILE_FORMAT) {
    throw new IdbError("Ce fichier n'est pas un export de signets de Bailly.");
  }
  if (typeof data.version !== "number" || data.version > BOOKMARKS_FILE_VERSION) {
    throw new IdbError("Ce fichier provient d'une version plus récente de Bailly : mettez l'application à jour.");
  }

  return validateState(data.state, now);
}
