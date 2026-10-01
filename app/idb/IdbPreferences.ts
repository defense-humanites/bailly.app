import { maxStamp } from "./clock";
import { Idb, IdbMetaKey, IdbStore } from "./Idb";
import { mergePreferenceRecords, preferenceRecords, type PreferenceRecord } from "./preferenceRecords";
import type { Preferences } from "~/utils/preferences";

/**
 * The stamps of the synchronizable preferences set on this device (cf.
 * `preferenceRecords.ts`), so that the synchronization keeps the latest
 * change of each. Their values are applied from the preferences cookie (cf.
 * `usePreferences`), read by the server too.
 */
export class IdbPreferences {
  /**
   * The records of the synchronizable preferences set on this device.
   */
  static async getRecords(): Promise<PreferenceRecord[]> {
    return (await Idb.readMeta(IdbMetaKey.Preferences)) ?? [];
  }

  /**
   * Records preferences that the user has just set: each synchronizable one
   * receives a stamp, whether its synchronization is enabled or not, so that
   * an enabling later compares the right dates.
   * @returns The records written.
   */
  static async record(values: Partial<Preferences>): Promise<PreferenceRecord[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Meta, "readwrite");
    const meta = tx.objectStore(IdbStore.Meta);
    const changed = preferenceRecords(values, await Idb.stamp(meta));
    if (changed.length) {
      const stored = (await Idb.getMeta(meta, IdbMetaKey.Preferences)) ?? [];
      await meta.put(mergePreferenceRecords(stored, changed), IdbMetaKey.Preferences);
    }
    await tx.done;
    return changed;
  }

  /**
   * Merges records received from the other devices into those of this
   * device, the clock following their stamps.
   * @returns The merged records.
   */
  static async merge(received: PreferenceRecord[]): Promise<PreferenceRecord[]> {
    const db = await Idb.getIndexedDB();
    const tx = db.transaction(IdbStore.Meta, "readwrite");
    const meta = tx.objectStore(IdbStore.Meta);
    const merged = mergePreferenceRecords((await Idb.getMeta(meta, IdbMetaKey.Preferences)) ?? [], received);
    await meta.put(merged, IdbMetaKey.Preferences);
    const clock = maxStamp(await Idb.getMeta(meta, IdbMetaKey.Clock), ...received.map(record => record.updatedAt));
    if (clock) await meta.put(clock, IdbMetaKey.Clock);
    await tx.done;
    return merged;
  }
}
