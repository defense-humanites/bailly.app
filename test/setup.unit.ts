import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { clearIdb } from "./idbHelpers";

/**
 * Isolates the tests: each test starts with empty stores, default `Idb`
 * settings and an empty `localStorage`, even if the previous one failed.
 */
afterEach(async () => {
  await clearIdb();
  localStorage.clear();
});
