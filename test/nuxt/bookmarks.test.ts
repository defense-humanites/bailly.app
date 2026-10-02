import { createPinia } from "pinia";
import { expect, test, vi } from "vitest";
import { StorageKey } from "~/enums";
import { IdbBookmarks, IdbTaggedEntry, IdbTags } from "~/idb";
import { formatStamp } from "~/idb/clock";
import { emptyState } from "~/idb/merge";
import { useBookmarksStore } from "~/stores/bookmarks";
import { clearIdb, entries, tags, unwrap } from "../idbHelpers";

/**
 * Returns a fresh store.
 * @remarks The Pinia instance must be passed explicitly: otherwise the
 * app's one is injected, whose store is initialized by the client plugin.
 */
const newStore = () => useBookmarksStore(createPinia());

test("initialize loads the stored data", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  unwrap(await IdbTaggedEntry.add(entries.rhinokeros, banquet.key));

  const store = newStore();
  await Promise.all([store.initialize(), store.initialize()]);

  expect(store.initialized).toBe(true);
  expect(store.tags).toHaveLength(1);
  expect(store.tagKeysOf(entries.rhinokeros.uri)).toEqual([banquet.key]);
  expect(store.newTagColor).toBeTypeOf("string");
});

test("a failed initialization is tried again by the next call", async () => {
  const store = newStore();
  const getAll = vi.spyOn(IdbTags, "getAll").mockRejectedValueOnce(new Error("blocked"));
  await expect(store.initialize()).rejects.toThrow("blocked");
  expect(store.initialized).toBe(false);
  await store.initialize();
  expect(store.initialized).toBe(true);
  getAll.mockRestore();
});

test("the current tag key is read from the local storage", async () => {
  unwrap(await IdbTags.add(tags.banquet));
  const theetete = unwrap(await IdbTags.add(tags.theetete));
  localStorage.setItem(StorageKey.CurrentTag, theetete.key);

  const store = newStore();
  await store.initialize();
  expect(store.currentTag?.name).toBe("Théétète");
});

test("the first tag becomes current when the current one is missing", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet)); // First (by name).
  unwrap(await IdbTags.add(tags.theetete));
  localStorage.setItem(StorageKey.CurrentTag, "999");

  const store = newStore();
  await store.initialize();
  expect(store.currentTagKey).toBe(banquet.key);
});

test("createTag makes the new tag current and persists its key", async () => {
  const store = newStore();
  await store.initialize();

  const banquet = unwrap(await store.createTag(tags.banquet));
  expect(store.currentTag?.key).toBe(banquet.key);
  await nextTick();
  expect(localStorage.getItem(StorageKey.CurrentTag)).toBe(banquet.key);
});

test("tagEntry / untagEntry", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));

  expect((await store.tagEntry(entries.rhinokeros, banquet.key)).state).toBe("success");
  expect(store.entriesOf(banquet.key)).toHaveLength(1);

  // A failure is reported to the user.
  const toasts = useToast().toasts;
  const toastCount = toasts.value.length;
  expect((await store.tagEntry(entries.rhinokeros, banquet.key)).state).toBe("error");
  expect(toasts.value.length).toBe(toastCount + 1);
  expect(store.entriesOf(banquet.key)).toHaveLength(1);

  await store.untagEntry(entries.rhinokeros.uri, banquet.key);
  expect(store.entriesOf(banquet.key)).toHaveLength(0);
});

test("starEntry / unstarEntry", async () => {
  const store = newStore();
  await store.initialize();

  await store.starEntry(entries.alopex);
  expect(store.isStarred(entries.alopex.uri)).toBe(true);

  await store.unstarEntry(entries.alopex.uri);
  expect(store.isStarred(entries.alopex.uri)).toBe(false);
});

test("removeTag detaches its entries and updates the current tag", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));
  const theetete = unwrap(await store.createTag(tags.theetete)); // Current.
  await store.tagEntry(entries.rhinokeros, theetete.key);

  await store.removeTag(theetete.key);
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key]);
  expect(store.taggedEntries).toHaveLength(0);
  expect(store.currentTag?.key).toBe(banquet.key);
});

test("pinTag pins a tag first, without changing the current tag", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));
  const theetete = unwrap(await store.createTag(tags.theetete)); // Current.
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key, theetete.key]);

  unwrap(await store.pinTag(theetete.key, true));
  expect(store.tags.map(tag => tag.key)).toEqual([theetete.key, banquet.key]);
  store.setCurrentTag(banquet.key);
  unwrap(await store.pinTag(banquet.key, true));
  expect(store.tags.map(tag => tag.key)).toEqual([theetete.key, banquet.key]); // In the order of their pinning.
  unwrap(await store.pinTag(theetete.key, false));
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key, theetete.key]);
  expect(store.currentTagKey).toBe(banquet.key);
});

test("a current tag stored before the migration to UUIDs is found by its former key", async () => {
  const stamp = formatStamp({ time: Date.now(), counter: 0, node: "test" });
  unwrap(await IdbTags.add(tags.banquet)); // First (by name).
  unwrap(await IdbBookmarks.merge({
    tags: [{ key: "migrated", name: "Théétète", description: "", color: "Blue", createdAt: "0", updatedAt: stamp, legacyKey: 7 }],
    tagged: [],
    starred: [],
  }));
  localStorage.setItem(StorageKey.CurrentTag, "7");

  const store = newStore();
  await store.initialize();
  expect(store.currentTag?.name).toBe("Théétète");
  await nextTick();
  expect(localStorage.getItem(StorageKey.CurrentTag)).toBe("migrated");
});

test("mergeState merges a state and reloads the store", async () => {
  const store = newStore();
  await store.initialize();
  const stamp = formatStamp({ time: Date.now() + 1_000, counter: 0, node: "test" });

  const result = await store.mergeState({
    tags: [{ key: "remote", name: "Lysis", description: "", color: "Green", createdAt: stamp, updatedAt: stamp }],
    tagged: [{ tagKey: "remote", uri: entries.rhinokeros.uri, word: entries.rhinokeros.word, updatedAt: stamp }],
    starred: [{ uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: stamp }],
  });

  expect(result.state).toBe("success");
  expect(store.tags.map(tag => tag.name)).toEqual(["Lysis"]);
  expect(store.entriesOf("remote")).toHaveLength(1);
  expect(store.isStarred(entries.alopex.uri)).toBe(true);
});

test("exportBookmarks / importBookmarks: a file brings the bookmarks to another device", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));
  await store.tagEntry(entries.rhinokeros, banquet.key);
  await store.starEntry(entries.alopex);
  const file = JSON.stringify(await store.exportBookmarks());

  // Another device (an empty database), which has a favorite of its own.
  await clearIdb();
  const other = newStore();
  await other.initialize();
  await other.refresh();
  await other.starEntry(entries.rhinokeros);

  expect((await other.importBookmarks(file)).state).toBe("success");
  expect(other.tags.map(tag => tag.name)).toEqual([tags.banquet.name]);
  expect(other.entriesOf(banquet.key)).toHaveLength(1);
  expect(other.starredEntries.map(entry => entry.uri).sort()).toEqual([entries.alopex.uri, entries.rhinokeros.uri].sort());
});

test("importBookmarks reports an invalid file", async () => {
  const store = newStore();
  await store.initialize();
  const toasts = useToast().toasts;
  const toastCount = toasts.value.length;

  const result = await store.importBookmarks("{}");
  expect(result).toEqual({ state: "error", message: "Ce fichier n'est pas un export de signets de Bailly." });
  expect(toasts.value.length).toBe(toastCount + 1);
});

test("importBookmarks restores bookmarks deleted after the export", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));
  await store.tagEntry(entries.rhinokeros, banquet.key);
  await store.starEntry(entries.alopex);
  const file = JSON.stringify(await store.exportBookmarks());

  await store.removeTag(banquet.key);
  await store.unstarEntry(entries.alopex.uri);
  expect(store.tags).toHaveLength(0);

  expect((await store.importBookmarks(file)).state).toBe("success");
  expect(store.tags.map(tag => tag.name)).toEqual([tags.banquet.name]);
  expect(store.entriesOf(banquet.key)).toHaveLength(1);
  expect(store.isStarred(entries.alopex.uri)).toBe(true);
});

test("after a merge, the current tag stays, whatever the order of the tags", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  const theetete = unwrap(await IdbTags.add(tags.theetete));
  const store = newStore();
  await store.initialize();
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key, theetete.key]);
  store.setCurrentTag(theetete.key);

  const stamp = (offset: number) => formatStamp({ time: Date.now() + offset, counter: 0, node: "test" });
  const state = await IdbBookmarks.getState();

  // Pinned on another device: it comes first, the current tag stays.
  const pinned = state.tags.map(tag => (tag.key === banquet.key ? { ...tag, pinnedAt: stamp(1_000), updatedAt: stamp(1_000) } : tag));
  unwrap(await store.mergeState({ ...state, tags: pinned }));
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key, theetete.key]);
  expect(store.currentTagKey).toBe(theetete.key);

  // A tag created on another device, first by name: the current tag stays.
  const alcibiade = { key: "remote", name: "Alcibiade", description: "", color: "Green" as const, createdAt: stamp(2_000), updatedAt: stamp(2_000) };
  unwrap(await store.mergeState({ ...emptyState(), tags: [alcibiade] }));
  expect(store.tags.map(tag => tag.name)).toEqual([tags.banquet.name, "Alcibiade", tags.theetete.name]);
  expect(store.currentTagKey).toBe(theetete.key);

  // The current tag fused into its homonym, created first on another device:
  // the homonym becomes the current one.
  const lysis = unwrap(await store.createTag({ name: "Lysis" }));
  expect(store.currentTagKey).toBe(lysis.key);
  const homonym = { key: "earlier", name: "lysis", description: "", color: "Rose" as const, createdAt: "0000000000001-0000-a", updatedAt: stamp(2_500) };
  unwrap(await store.mergeState({ ...emptyState(), tags: [homonym] }));
  expect(store.tags.map(tag => tag.key)).not.toContain(lysis.key);
  expect(store.currentTagKey).toBe("earlier");
  store.setCurrentTag(theetete.key);

  // The current tag deleted on another device: the first tag becomes the current one.
  const deleted = (await IdbBookmarks.getState()).tags.map(tag => (tag.key === theetete.key ? { ...tag, deleted: true as const, updatedAt: stamp(3_000) } : tag));
  unwrap(await store.mergeState({ ...emptyState(), tags: deleted }));
  expect(store.currentTagKey).toBe(banquet.key);
});

test("hold counts the interactions in progress", () => {
  const store = newStore();
  const first = store.hold();
  const second = store.hold();
  first();
  first(); // Released once only.
  expect(store.held).toBe(true);
  second();
  expect(store.held).toBe(false);
});
