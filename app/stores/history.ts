import { defineStore } from "pinia";
import { IdbHistory, type IdbEntry, type IdbEntryCreation } from "~/idb";

/**
 * The history of the viewed entries (stored in IndexedDB), from the newest to
 * the oldest. It is loaded on demand, in the browser only.
 */
export const useHistoryStore = defineStore("history", () => {
  const entries = ref<IdbEntry[]>([]);
  const loaded = ref(false);

  async function load(): Promise<void> {
    entries.value = await IdbHistory.get();
    loaded.value = true;
  }

  /**
   * Adds a viewed entry (or moves it to the top).
   */
  async function add(entry: IdbEntryCreation): Promise<void> {
    const result = await IdbHistory.add(entry);
    if (result.state === "success" && loaded.value) await load();
  }

  async function clear(): Promise<void> {
    await IdbHistory.clear();
    entries.value = [];
  }

  return { entries, loaded, load, add, clear };
});
