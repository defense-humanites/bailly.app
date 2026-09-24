import { createPinia } from "pinia";
import { expect, test } from "vitest";
import { LocalStorageKey } from "~/enums";
import { IdbTaggedEntry, IdbTags } from "~/idb";
import { useBookmarksStore } from "~/stores/bookmarks";
import { entries, tags, unwrap } from "../idbHelpers";

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

test("the current tag key is compatible with the Astro app", async () => {
  unwrap(await IdbTags.add(tags.banquet));
  const theetete = unwrap(await IdbTags.add(tags.theetete));
  // The Astro app stored the key as a string.
  localStorage.setItem(LocalStorageKey.CurrentTagKey, String(theetete.key));

  const store = newStore();
  await store.initialize();
  expect(store.currentTag?.name).toBe("Théétète");
});

test("the first tag becomes current when the current one is missing", async () => {
  unwrap(await IdbTags.add(tags.banquet));
  const theetete = unwrap(await IdbTags.add(tags.theetete)); // First position.
  localStorage.setItem(LocalStorageKey.CurrentTagKey, "999");

  const store = newStore();
  await store.initialize();
  expect(store.currentTagKey).toBe(theetete.key);
});

test("createTag makes the new tag current and persists its key", async () => {
  const store = newStore();
  await store.initialize();

  const banquet = unwrap(await store.createTag(tags.banquet));
  expect(store.currentTag?.key).toBe(banquet.key);
  await nextTick();
  expect(localStorage.getItem(LocalStorageKey.CurrentTagKey)).toBe(String(banquet.key));
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

test("reorderTags makes the first tag current", async () => {
  const store = newStore();
  await store.initialize();
  const banquet = unwrap(await store.createTag(tags.banquet));
  const theetete = unwrap(await store.createTag(tags.theetete)); // First and current.

  await store.reorderTags([banquet.key, theetete.key]);
  expect(store.tags.map(tag => tag.key)).toEqual([banquet.key, theetete.key]);
  expect(store.currentTag?.key).toBe(banquet.key);
});
