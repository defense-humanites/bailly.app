import { maxStamp, stampTime, type Stamp } from "./clock";
import type { TagColorKey } from "./IdbTags";

/**
 * The bookmarks as stored, in a form that merges without conflicts: the state
 * of two devices (or of a device and an imported file) always merges into
 * the same result, whatever the order of the merges (a state-based CRDT).
 *
 * - Each record carries the stamp of its last change (`updatedAt`); when two
 *   versions of a record meet, the latest wins (last writer wins).
 * - A deletion is a version like any other (`deleted`: a tombstone), so that
 *   it is not undone by a device that still has the record.
 * - The order of the tags is a single record (`tagOrder`), written only when
 *   the user arranges them: the tags it does not list (created since, e.g. on
 *   another device) come first, the latest created first.
 */

/**
 * The key of a tag: a UUID, the same on every device.
 */
export type TagKey = string;

type Versioned = {
  /**
   * The stamp of the latest change.
   */
  updatedAt: Stamp;
  /**
   * Set if the record has been deleted (tombstone).
   */
  deleted?: true;
};

export type TagRecord = Versioned & {
  key: TagKey;
  name: string;
  description: string;
  color: TagColorKey;
  createdAt: Stamp;
  /**
   * The key of the tag in the previous schema (numeric), to find the current
   * tag stored in the local storage before the migration.
   */
  legacyKey?: number;
};

export type TaggedRecord = Versioned & {
  tagKey: TagKey;
  uri: string;
  word: string;
  /**
   * The excerpt of the entry: a local copy (cf. `withoutExcerpts`), absent
   * or empty until known.
   */
  excerpt?: string;
};

export type StarredRecord = Versioned & {
  uri: string;
  word: string;
  /**
   * The excerpt of the entry: a local copy (cf. `withoutExcerpts`), absent
   * or empty until known.
   */
  excerpt?: string;
};

export type TagOrder = {
  keys: TagKey[];
  updatedAt: Stamp;
};

export type BookmarksState = {
  tags: TagRecord[];
  tagged: TaggedRecord[];
  starred: StarredRecord[];
  tagOrder: TagOrder | null;
};

export const emptyState = (): BookmarksState => ({ tags: [], tagged: [], starred: [], tagOrder: null });

/**
 * The tombstone of a tag: only what identifies it and makes it valid is kept
 * (not its name nor its description), with the stamp of its deletion.
 */
export const tagTombstone = (tag: TagRecord, updatedAt: Stamp): TagRecord => ({
  key: tag.key,
  name: "",
  description: "",
  color: tag.color,
  createdAt: tag.createdAt,
  updatedAt,
  deleted: true,
});

/**
 * The tombstone of a favorite or of a tagged entry: only its identity is kept
 * (not its word nor its excerpt), with the stamp of its deletion.
 */
export const entryTombstone = <T extends TaggedRecord | StarredRecord>(record: T, updatedAt: Stamp): T => ({
  ...withoutExcerpt(record),
  word: "",
  updatedAt,
  deleted: true,
});

/**
 * A record without its excerpt.
 */
const withoutExcerpt = <T extends TaggedRecord | StarredRecord>({ excerpt: _excerpt, ...record }: T): T => record as T;

/**
 * A state without the excerpts of its entries. The excerpts are not part of
 * the bookmarks as merged and synchronized: each device keeps a copy of those
 * it knows (added on it, or fetched from the API), so that the lockers stay
 * small and the excerpts shown always come from the dictionary.
 */
export function withoutExcerpts(state: BookmarksState): BookmarksState {
  return {
    ...state,
    tagged: state.tagged.map(withoutExcerpt),
    starred: state.starred.map(withoutExcerpt),
  };
}

/**
 * The excerpts known in a state, by URI.
 */
export function knownExcerpts(state: BookmarksState): Map<string, string> {
  const excerpts = new Map<string, string>();
  for (const record of [...state.tagged, ...state.starred]) {
    if (record.excerpt && !record.deleted) excerpts.set(record.uri, record.excerpt);
  }
  return excerpts;
}

/**
 * Gives the live entries of a state the excerpts known for their URI.
 */
export function withExcerpts(state: BookmarksState, excerpts: Map<string, string>): BookmarksState {
  const give = <T extends TaggedRecord | StarredRecord>(record: T): T => {
    const excerpt = record.deleted ? undefined : excerpts.get(record.uri);
    return excerpt ? { ...record, excerpt } : record;
  };
  return { ...state, tagged: state.tagged.map(give), starred: state.starred.map(give) };
}

/**
 * The identity of the records of each kind.
 */
export const recordId = {
  tag: (record: Pick<TagRecord, "key">): string => record.key,
  tagged: (record: Pick<TaggedRecord, "tagKey" | "uri">): string => `${record.tagKey}\u0000${record.uri}`,
  starred: (record: Pick<StarredRecord, "uri">): string => record.uri,
};

/**
 * Makes tag names comparable regardless of case and diacritics.
 */
export const comparableTagName = (name: string): string =>
  name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Serializes a value with sorted object keys, so that equal values give equal
 * strings.
 */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
}

/**
 * The version that wins between two versions of a record: the latest; at the
 * same stamp, the deletion; then, arbitrarily but deterministically, the
 * greater serialization.
 */
function latest<T extends { updatedAt: Stamp; deleted?: true }>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (Boolean(a.deleted) !== Boolean(b.deleted)) return a.deleted ? a : b;
  return canonical(a) >= canonical(b) ? a : b;
}

/**
 * Merges collections of records, keeping the latest version of each record.
 * @returns The records, sorted by identity (a canonical form).
 */
function mergeRecords<T extends Versioned>(id: (record: T) => string, ...collections: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const collection of collections) {
    for (const record of collection) {
      const key = id(record);
      const current = byId.get(key);
      byId.set(key, current ? latest(current, record) : record);
    }
  }
  return [...byId.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, record]) => record);
}

function mergeOrders(a: TagOrder | null, b: TagOrder | null): TagOrder | null {
  if (!a || !b) return a ?? b;
  return latest(a, b);
}

/**
 * Merges two states. Commutative, associative and idempotent.
 */
export function mergeStates(a: BookmarksState, b: BookmarksState): BookmarksState {
  return {
    tags: mergeRecords(recordId.tag, a.tags, b.tags),
    tagged: mergeRecords(recordId.tagged, a.tagged, b.tagged),
    starred: mergeRecords(recordId.starred, a.starred, b.starred),
    tagOrder: mergeOrders(a.tagOrder, b.tagOrder),
  };
}

/**
 * Restores the invariants that a merge may break.
 *
 * Tags with the same name (regardless of case and diacritics, e.g. created on
 * two devices before a synchronization) are fused: the first created one is
 * kept, the others are deleted and their entries move to it. The result only
 * depends on the state (the stamps are those of the records involved), so
 * that all devices fuse the same way.
 * @remarks The limits (number of tags, of entries per tag) are not enforced
 * here: a merge may exceed them, only new additions are then refused. The
 * entries of a deleted tag are ignored when reading.
 */
export function normalize(state: BookmarksState): BookmarksState {
  const groups = new Map<string, TagRecord[]>();
  for (const tag of state.tags) {
    if (tag.deleted) continue;
    const name = comparableTagName(tag.name);
    groups.set(name, [...(groups.get(name) ?? []), tag]);
  }

  /**
   * The fused tags, with the key of the tag they are fused into.
   */
  const fusedInto = new Map<TagKey, TagKey>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [kept, ...others] = [...group].sort((a, b) =>
      a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? -1 : 1) : (a.key < b.key ? -1 : 1),
    );
    for (const other of others) fusedInto.set(other.key, kept!.key);
  }
  if (!fusedInto.size) return state;

  const tags = state.tags.map(tag => (fusedInto.has(tag.key) ? tagTombstone(tag, tag.updatedAt) : tag));

  const moved: TaggedRecord[] = [];
  const tagged = state.tagged.map((record) => {
    const target = fusedInto.get(record.tagKey);
    if (target === undefined || record.deleted) return record;
    moved.push({ ...record, tagKey: target });
    return entryTombstone(record, record.updatedAt);
  });

  return {
    ...state,
    tags: mergeRecords(recordId.tag, tags),
    tagged: mergeRecords(recordId.tagged, tagged, moved),
  };
}

/**
 * The limits of the bookmarks (cf. `Idb.config`): tags, and entries per tag
 * (and favorites).
 */
export type BookmarksLimits = {
  maxTags: number;
  tagMaxItems: number;
};

/**
 * A limit that a state exceeds: the number of tags, or the number of entries
 * of a tag (its name) or of the favorites (`null`).
 */
export type LimitExcess
  = | { kind: "tags"; count: number }
    | { kind: "entries"; tag: string | null; count: number };

/**
 * The limits a state exceeds, e.g. once merged with another device's (none
 * if it keeps within them).
 * @remarks A merge that would exceed them is not applied: the user makes room
 * first (the bookmarks online always keep within them, each device checking
 * before writing).
 */
export function limitExcesses(state: BookmarksState, { maxTags, tagMaxItems }: BookmarksLimits): LimitExcess[] {
  const excesses: LimitExcess[] = [];
  const liveTags = state.tags.filter(tag => !tag.deleted);
  if (liveTags.length > maxTags) excesses.push({ kind: "tags", count: liveTags.length });

  const counts = new Map<TagKey, number>();
  for (const record of state.tagged) {
    if (!record.deleted) counts.set(record.tagKey, (counts.get(record.tagKey) ?? 0) + 1);
  }
  for (const tag of liveTags) {
    const count = counts.get(tag.key) ?? 0;
    if (count > tagMaxItems) excesses.push({ kind: "entries", tag: tag.name, count });
  }

  const starred = state.starred.filter(record => !record.deleted).length;
  if (starred > tagMaxItems) excesses.push({ kind: "entries", tag: null, count: starred });

  return excesses;
}

/**
 * What an import leaves out to keep within the limits.
 */
export type SkippedRecords = {
  tags: number;
  entries: number;
};

/**
 * Keeps an imported state within what the limits leave room for, once
 * restored into the local one (cf. `restoreRecords`): the local bookmarks all
 * stay; among the new tags, those created first are imported, and among the
 * new entries of a tag (or of the favorites), those added first. The rest is
 * left out (an import never deletes anything).
 * @remarks The tags are counted by name, as `normalize` fuses the homonyms.
 */
export function fitImport(
  local: BookmarksState,
  imported: BookmarksState,
  { maxTags, tagMaxItems }: BookmarksLimits,
): { state: BookmarksState; skipped: SkippedRecords } {
  const byAdded = <T extends Versioned & { uri: string }>(a: T, b: T): number =>
    a.updatedAt !== b.updatedAt ? (a.updatedAt < b.updatedAt ? -1 : 1) : (a.uri < b.uri ? -1 : 1);

  // The tags once restored (the latest live version of each), by name.
  const tags = new Map<TagKey, TagRecord>();
  for (const tag of [...local.tags, ...imported.tags]) {
    if (tag.deleted) continue;
    const current = tags.get(tag.key);
    if (!current || tag.updatedAt > current.updatedAt) tags.set(tag.key, tag);
  }
  const groups = new Map<string, TagRecord[]>();
  for (const tag of tags.values()) {
    const name = comparableTagName(tag.name);
    groups.set(name, [...(groups.get(name) ?? []), tag]);
  }

  // New tags (no local one of that name), the first created first.
  const localKeys = new Set(local.tags.filter(tag => !tag.deleted).map(tag => tag.key));
  const existing = [...groups.values()].filter(group => group.some(tag => localKeys.has(tag.key)));
  const created = (group: TagRecord[]): Stamp => group.map(tag => tag.createdAt).sort()[0]!;
  const added = [...groups.values()]
    .filter(group => !existing.includes(group))
    .sort((a, b) => (created(a) < created(b) ? -1 : created(a) > created(b) ? 1 : 0));
  const skippedGroups = added.slice(Math.max(0, maxTags - existing.length));
  const skippedKeys = new Set(skippedGroups.flatMap(group => group.map(tag => tag.key)));

  /**
   * The imported entries left out of a collection (a tag, or the
   * favorites): those beyond the room left by the local ones.
   */
  const overflow = <T extends Versioned & { uri: string }>(localRecords: T[], importedRecords: T[]): Set<string> => {
    const here = new Set(localRecords.filter(record => !record.deleted).map(record => record.uri));
    const seen = new Set<string>();
    const fresh = importedRecords
      .filter(record => !record.deleted && !here.has(record.uri))
      .sort(byAdded)
      .filter((record) => {
        if (seen.has(record.uri)) return false;
        seen.add(record.uri);
        return true;
      });
    return new Set(fresh.slice(Math.max(0, tagMaxItems - here.size)).map(record => record.uri));
  };

  let skippedEntries = 0;
  const skippedTagged = new Set<string>();
  for (const group of groups.values()) {
    const keys = new Set(group.map(tag => tag.key));
    const importedRecords = imported.tagged.filter(record => keys.has(record.tagKey));
    if (skippedKeys.has(group[0]!.key)) {
      const uris = new Set(importedRecords.filter(record => !record.deleted).map(record => record.uri));
      skippedEntries += uris.size;
      continue;
    }
    const uris = overflow(local.tagged.filter(record => keys.has(record.tagKey)), importedRecords);
    skippedEntries += uris.size;
    for (const record of importedRecords) {
      if (uris.has(record.uri)) skippedTagged.add(recordId.tagged(record));
    }
  }
  const skippedStarred = overflow(local.starred, imported.starred);
  skippedEntries += skippedStarred.size;

  return {
    state: {
      ...imported,
      tags: imported.tags.filter(tag => !skippedKeys.has(tag.key)),
      tagged: imported.tagged.filter(record => !skippedKeys.has(record.tagKey) && !skippedTagged.has(recordId.tagged(record))),
      starred: imported.starred.filter(record => !skippedStarred.has(record.uri)),
    },
    skipped: { tags: skippedGroups.length, entries: skippedEntries },
  };
}

/**
 * How long tombstones are kept (90 days): long enough for the devices of a
 * user to meet in the meantime.
 */
export const TOMBSTONE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

/**
 * Removes the tombstones older than `maxAge`: a device that has not merged
 * for longer could bring back what they deleted.
 */
export function compact(state: BookmarksState, maxAge: number = TOMBSTONE_MAX_AGE, now: number = Date.now()): BookmarksState {
  const keep = (record: Versioned): boolean => !record.deleted || now - stampTime(record.updatedAt) <= maxAge;
  return {
    ...state,
    tags: state.tags.filter(keep),
    tagged: state.tagged.filter(keep),
    starred: state.starred.filter(keep),
  };
}

/**
 * A state without its tombstones (e.g. in an exported file).
 */
export function withoutTombstones(state: BookmarksState): BookmarksState {
  return {
    ...state,
    tags: state.tags.filter(tag => !tag.deleted),
    tagged: state.tagged.filter(record => !record.deleted),
    starred: state.starred.filter(record => !record.deleted),
  };
}

/**
 * Prepares an imported state (a backup) to be merged into the local one, so
 * that the import restores what the file contains without undoing the later
 * changes: the records missing or deleted here are restored as changes made
 * now (`stamp`), which supersede their deletion; the others keep the latest
 * version, as in a synchronization; the file's tombstones are ignored (an
 * import never deletes anything).
 */
export function restoreRecords(local: BookmarksState, imported: BookmarksState, stamp: Stamp): BookmarksState {
  const restore = <T extends Versioned>(id: (record: T) => string, localRecords: T[], importedRecords: T[]): T[] => {
    const here = new Map(localRecords.map(record => [id(record), record]));
    return importedRecords
      .filter(record => !record.deleted)
      .map((record) => {
        const current = here.get(id(record));
        return !current || current.deleted ? { ...record, updatedAt: stamp } : record;
      });
  };

  return {
    tags: restore(recordId.tag, local.tags, imported.tags),
    tagged: restore(recordId.tagged, local.tagged, imported.tagged),
    starred: restore(recordId.starred, local.starred, imported.starred),
    tagOrder: imported.tagOrder,
  };
}

/**
 * Prepares the state of the locker to be merged into the local one, the first
 * time this device synchronizes with a key (joined, or enabled again): what
 * exists online and was deleted on this device comes back, as a change made
 * now (`stamp`), so that the device does not delete it on the others (e.g.
 * deleted while it was not synchronized). The deletions made online by the
 * other devices apply, and the device's additions and later changes stay.
 */
export function joinRecords(local: BookmarksState, remote: BookmarksState, stamp: Stamp): BookmarksState {
  const rejoin = <T extends Versioned>(id: (record: T) => string, localRecords: T[], remoteRecords: T[]): T[] => {
    const here = new Map(localRecords.map(record => [id(record), record]));
    return remoteRecords.map(record =>
      !record.deleted && here.get(id(record))?.deleted ? { ...record, updatedAt: stamp } : record,
    );
  };

  return {
    tags: rejoin(recordId.tag, local.tags, remote.tags),
    tagged: rejoin(recordId.tagged, local.tagged, remote.tagged),
    starred: rejoin(recordId.starred, local.starred, remote.starred),
    tagOrder: remote.tagOrder,
  };
}

/**
 * The latest stamp of a state.
 */
export function latestStamp(state: BookmarksState): Stamp | undefined {
  return maxStamp(
    ...state.tags.map(tag => tag.updatedAt),
    ...state.tagged.map(record => record.updatedAt),
    ...state.starred.map(record => record.updatedAt),
    state.tagOrder?.updatedAt,
  );
}

/**
 * Sorts the (live) tags for display: first those the order does not list, the
 * latest created first, then those it lists, in its order.
 */
export function orderTags<T extends Pick<TagRecord, "key" | "createdAt">>(tags: T[], order: TagOrder | null): T[] {
  const position = new Map((order?.keys ?? []).map((key, index) => [key, index]));
  const unlisted = tags
    .filter(tag => !position.has(tag.key))
    .sort((a, b) => (a.createdAt !== b.createdAt ? (a.createdAt > b.createdAt ? -1 : 1) : (a.key < b.key ? -1 : 1)));
  const listed = tags
    .filter(tag => position.has(tag.key))
    .sort((a, b) => position.get(a.key)! - position.get(b.key)!);
  return [...unlisted, ...listed];
}
