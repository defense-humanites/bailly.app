import { afterEach, expect, test, vi } from "vitest";
import { requestPersistentStorage, resetPersistentStorageRequest } from "../../app/utils/persistentStorage";

afterEach(() => {
  vi.unstubAllGlobals();
  resetPersistentStorageRequest();
});

const stubStorage = (storage: Partial<StorageManager> | undefined) => {
  vi.stubGlobal("navigator", { storage });
};

test("asks once per visit", async () => {
  const persist = vi.fn(() => Promise.resolve(true));
  stubStorage({ persisted: () => Promise.resolve(false), persist });

  expect(await requestPersistentStorage()).toBe(true);
  expect(await requestPersistentStorage()).toBe(false);
  expect(persist).toHaveBeenCalledTimes(1);
});

test("does not ask when the storage is already persistent", async () => {
  const persist = vi.fn(() => Promise.resolve(true));
  stubStorage({ persisted: () => Promise.resolve(true), persist });

  expect(await requestPersistentStorage()).toBe(true);
  expect(persist).not.toHaveBeenCalled();
});

test("never throws (unsupported, or refused by the browser)", async () => {
  stubStorage(undefined);
  expect(await requestPersistentStorage()).toBe(false);

  resetPersistentStorageRequest();
  stubStorage({ persisted: () => Promise.reject(new Error("denied")), persist: () => Promise.resolve(true) });
  expect(await requestPersistentStorage()).toBe(false);
});
