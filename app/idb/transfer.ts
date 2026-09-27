import { isStamp } from "./clock";
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
} from "./merge";

/**
 * The bookmarks as exchanged outside of the browser (exported file, and the
 * content of the synchronized state): the whole state, tombstones included,
 * so that importing it merges like a synchronization would.
 */
export type BookmarksFile = {
  format: typeof BOOKMARKS_FILE_FORMAT;
  version: typeof BOOKMARKS_FILE_VERSION;
  /**
   * The date of the export (ISO 8601).
   */
  exportedAt: string;
  state: BookmarksState;
};

export const BOOKMARKS_FILE_FORMAT = "bailly-bookmarks";
export const BOOKMARKS_FILE_VERSION = 1;

/**
 * The maximum number of records of a file (beyond the limits of the
 * application, with room for the tombstones).
 */
const MAX_RECORDS = 20_000;
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

export function toBookmarksFile(state: BookmarksState, now: Date = new Date()): BookmarksFile {
  return {
    format: BOOKMARKS_FILE_FORMAT,
    version: BOOKMARKS_FILE_VERSION,
    exportedAt: now.toISOString(),
    state: exportState(state),
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
 * The common fields of the records, if valid.
 */
function versioned(value: Record<string, unknown>): { updatedAt: string; deleted?: true } | null {
  if (!isStamp(value.updatedAt) || (value.deleted !== undefined && value.deleted !== true)) return null;
  return { updatedAt: value.updatedAt, ...(value.deleted ? { deleted: true as const } : {}) };
}

function validateTag(value: unknown): TagRecord | null {
  if (!isObject(value) || !isText(value.key, { required: true }) || !isText(value.name, { required: true })) return null;
  const common = versioned(value);
  if (!common || !isStamp(value.createdAt)) return null;

  const name = value.name.trim();
  if (comparableTagName(name) === "favoris") return null;

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

function validateEntry(value: Record<string, unknown>): { uri: string; word: string; excerpt: string } | null {
  if (!isText(value.uri, { required: true }) || !isText(value.word) || !isText(value.excerpt)) return null;
  return { uri: value.uri, word: value.word, excerpt: value.excerpt };
}

function validateTagged(value: unknown): TaggedRecord | null {
  if (!isObject(value) || !isText(value.tagKey, { required: true })) return null;
  const common = versioned(value);
  const entry = validateEntry(value);
  return common && entry ? { tagKey: value.tagKey, ...entry, ...common } : null;
}

function validateStarred(value: unknown): StarredRecord | null {
  if (!isObject(value)) return null;
  const common = versioned(value);
  const entry = validateEntry(value);
  return common && entry ? { ...entry, ...common } : null;
}

function validateOrder(value: unknown): TagOrder | null {
  if (!isObject(value) || !isStamp(value.updatedAt) || !Array.isArray(value.keys)) return null;
  const keys = value.keys.filter((key): key is string => isText(key, { required: true }));
  return { keys: [...new Set(keys)], updatedAt: value.updatedAt };
}

/**
 * Validates a state from the outside (a file, another device): invalid
 * records are left out, rather than refusing everything.
 * @throws {IdbError} If the value is not a state at all, or too large.
 */
export function validateState(value: unknown): BookmarksState {
  if (!isObject(value) || !Array.isArray(value.tags) || !Array.isArray(value.tagged) || !Array.isArray(value.starred)) {
    throw new IdbError("Ce fichier ne contient pas de signets.");
  }
  if (value.tags.length + value.tagged.length + value.starred.length > MAX_RECORDS) {
    throw new IdbError("Ce fichier contient trop de signets.");
  }

  const keep = <T>(records: (T | null)[]): T[] => records.filter((record): record is T => record !== null);

  // Canonical form (duplicates merged).
  return mergeStates({
    tags: keep(value.tags.map(validateTag)),
    tagged: keep(value.tagged.map(validateTagged)),
    starred: keep(value.starred.map(validateStarred)),
    tagOrder: value.tagOrder === null || value.tagOrder === undefined ? null : validateOrder(value.tagOrder),
  }, emptyState());
}

/**
 * Reads an exported file.
 * @returns The state it contains.
 * @throws {IdbError} If the file is not a (supported) export of the bookmarks.
 */
export function parseBookmarksFile(text: string): BookmarksState {
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

  return validateState(data.state);
}
