let requested = false;

/**
 * Asks the browser not to evict the application's storage (the bookmarks)
 * when space runs out, once per visit.
 * @remarks Browsers decide: Chrome grants it according to the use of the
 * site (e.g. installed), Firefox may ask the user, Safari may exempt the site
 * from the deletion of the data of sites not visited for 7 days (to be
 * checked). Never throws.
 * @returns Whether the storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (requested) return false;
  requested = true;

  try {
    // Missing in older browsers, despite the DOM types.
    const storage = (globalThis.navigator as Navigator | undefined)?.storage;
    if (typeof storage?.persist !== "function") return false;
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/**
 * Forgets that the persistent storage was requested (for the tests).
 */
export function resetPersistentStorageRequest(): void {
  requested = false;
}
