import type { Stamp } from "./clock";
import { isStamp, stampTime } from "./clock";
import { mergeRecords } from "./merge";
import { MAX_FUTURE_DRIFT } from "./transfer";
import { isSyncablePreference, parsePreferences, SYNCABLE_PREFERENCES, type Preferences, type SyncablePreference } from "~/utils/preferences";

/**
 * The synchronizable preferences, in a form that merges without conflicts
 * (as the bookmarks, cf. `merge.ts`): one record per preference, carrying
 * the stamp of its latest change; when two versions meet, the latest wins,
 * each preference on its own.
 *
 * - A preference is never deleted: a reset writes its default value.
 * - A record whose key this version does not know (added since), or whose
 *   value it cannot apply (e.g. a font added since), is kept and passed on as
 *   it is, but not applied.
 */
export type PreferenceRecord = {
  key: string;
  value: PreferenceValue;
  updatedAt: Stamp;
};

export type PreferenceValue = boolean | number | string;

/**
 * The bounds of the records received (a bug, a forged locker), besides the
 * size of the locker.
 */
export const MAX_PREFERENCE_RECORDS = 50;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 100;

/**
 * Merges collections of records, keeping the latest version of each
 * preference. Commutative, associative and idempotent.
 * @returns The records, sorted by key (a canonical form).
 */
export function mergePreferenceRecords(...collections: PreferenceRecord[][]): PreferenceRecord[] {
  return mergeRecords(record => record.key, ...collections);
}

const isValue = (value: unknown): value is PreferenceValue =>
  typeof value === "boolean"
  || (typeof value === "number" && Number.isFinite(value))
  || (typeof value === "string" && value.length <= MAX_VALUE_LENGTH);

/**
 * Validates records from the outside (another device): invalid ones are left
 * out; beyond `MAX_PREFERENCE_RECORDS`, the records of preferences this
 * version does not know are left out first, the oldest first (the known ones
 * are always kept).
 * @param now The reference time for the stamps too far in the future.
 */
export function validatePreferenceRecords(value: unknown, now: number = Date.now()): PreferenceRecord[] {
  if (!Array.isArray(value)) return [];
  // The whole array is read (it is bounded by the size of the locker), so that
  // invalid entries cannot push the known preferences out.
  const records = value.filter((record): record is PreferenceRecord =>
    typeof record === "object" && record !== null
    && typeof (record as PreferenceRecord).key === "string"
    && (record as PreferenceRecord).key.length > 0 && (record as PreferenceRecord).key.length <= MAX_KEY_LENGTH
    && isValue((record as PreferenceRecord).value)
    && isStamp((record as PreferenceRecord).updatedAt)
    && stampTime((record as PreferenceRecord).updatedAt) <= now + MAX_FUTURE_DRIFT,
  ).map(({ key, value, updatedAt }) => ({ key, value, updatedAt }));
  return boundPreferenceRecords(mergePreferenceRecords(records));
}

/**
 * Keeps at most `MAX_PREFERENCE_RECORDS` records: the known preferences
 * always, then the most recent others.
 */
export function boundPreferenceRecords(records: PreferenceRecord[]): PreferenceRecord[] {
  if (records.length <= MAX_PREFERENCE_RECORDS) return records;
  const known = records.filter(record => isSyncablePreference(record.key));
  const others = records.filter(record => !isSyncablePreference(record.key))
    .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0))
    .slice(0, Math.max(0, MAX_PREFERENCE_RECORDS - known.length));
  return mergePreferenceRecords(known, others);
}

/**
 * The value of a record, if this version can apply it.
 */
export function applicableValue<K extends SyncablePreference>(record: PreferenceRecord & { key: K }): Preferences[K] | undefined {
  return parsePreferences({ [record.key]: record.value })[record.key];
}

/**
 * The records of preferences set now, with a stamp (only the synchronizable
 * ones).
 */
export function preferenceRecords(values: Partial<Preferences>, stamp: Stamp): PreferenceRecord[] {
  return (Object.entries(values) as [string, PreferenceValue | undefined][])
    .filter((entry): entry is [SyncablePreference, PreferenceValue] => isSyncablePreference(entry[0]) && entry[1] !== undefined)
    .map(([key, value]) => ({ key, value, updatedAt: stamp }));
}

/**
 * The list of the preferences synchronized, shared by the devices of a key
 * (choosing it on one device chooses it on all): a record per synchronizable
 * preference, `synced:<key>`, whether it is synchronized, merged as the
 * others (the latest choice of each wins). Merged by every device that
 * synchronizes preferences, whichever they are.
 */
export const SYNCED_FLAG_PREFIX = "synced:";

export const isSyncedFlag = (key: string): boolean => key.startsWith(SYNCED_FLAG_PREFIX);

/**
 * The records of a list of preferences synchronized, with a stamp.
 */
export function syncedFlagRecords(list: readonly SyncablePreference[], stamp: Stamp): PreferenceRecord[] {
  return SYNCABLE_PREFERENCES.map(key => ({ key: `${SYNCED_FLAG_PREFIX}${key}`, value: list.includes(key), updatedAt: stamp }));
}

/**
 * The list of the preferences synchronized that records give, if they give
 * one (in the order of `SYNCABLE_PREFERENCES`).
 */
export function syncedListOf(records: readonly PreferenceRecord[]): SyncablePreference[] | null {
  const flags = records.filter(record => isSyncedFlag(record.key));
  if (!flags.length) return null;
  return SYNCABLE_PREFERENCES.filter(key => flags.some(flag => flag.key === `${SYNCED_FLAG_PREFIX}${key}` && flag.value === true));
}

/**
 * The notices dismissed (cf. `useDismissed`), synchronized with the
 * preferences, whichever they are (not a choice: a notice read on a device
 * is read): a record per notice, `dismissed:<id>`, always `true` (a notice is
 * never shown again), so that merging them unites them.
 */
export const DISMISSED_PREFIX = "dismissed:";

export const isDismissedRecord = (key: string): boolean => key.startsWith(DISMISSED_PREFIX);

/**
 * The records of notices dismissed, with a stamp.
 */
export function dismissedRecords(ids: readonly string[], stamp: Stamp): PreferenceRecord[] {
  return ids.map(id => ({ key: `${DISMISSED_PREFIX}${id}`, value: true, updatedAt: stamp }));
}

/**
 * The notices dismissed that records give.
 */
export function dismissedOf(records: readonly PreferenceRecord[]): string[] {
  return records.filter(record => isDismissedRecord(record.key) && record.value === true).map(record => record.key.slice(DISMISSED_PREFIX.length));
}
