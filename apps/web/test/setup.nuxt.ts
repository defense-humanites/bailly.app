import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { clearIdb } from "./idbHelpers";

/**
 * Isolates the tests (cf. `test/setup.unit.ts`).
 */
afterEach(async () => {
  await clearIdb();
  localStorage.clear();
});
