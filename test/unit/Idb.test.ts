import { expect, test, vi } from "vitest";
import { Idb } from "../../app/idb/Idb";

// Must run first: the connection must not have been opened yet.
test("Concurrent calls share a single connection", async () => {
  const [a, b] = await Promise.all([Idb.getIndexedDB(), Idb.getIndexedDB()]);
  expect(a).toBe(b);
});

test("Configuration ignores invalid values", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  Idb.configure({ searchHistoryLength: Number(undefined), tagMaxItems: 10, maxTags: -1 });
  expect(Idb.config).toEqual({ searchHistoryLength: 60, tagMaxItems: 10, maxTags: 50 });
  expect(warn).toHaveBeenCalledTimes(2);

  warn.mockRestore();
});
