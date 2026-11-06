import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { clearIdb } from "./idbHelpers";

/**
 * Isolates the tests: each test starts with empty stores, default `Idb`
 * settings and an empty `localStorage`, even if the previous one failed.
 */
afterEach(async () => {
  await clearIdb();
  // Absent from the tests run in the Node environment (e.g. cryptography).
  if (typeof localStorage !== "undefined") localStorage.clear();
});
