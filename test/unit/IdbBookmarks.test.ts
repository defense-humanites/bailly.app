import { expect, test } from "vitest";
import { entries, tags, unwrap } from "../idbHelpers";
import { Idb, IdbBookmarks, IdbStarred, IdbStore, IdbTaggedEntry, IdbTags, type BookmarksState } from "../../app/idb";
import { formatStamp, parseStamp } from "../../app/idb/clock";

const remoteStamp = (time: number) => formatStamp({ time, counter: 0, node: "remote" });

test("deletions leave tombstones in the state", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  unwrap(await IdbTaggedEntry.add(entries.rhinokeros, banquet.key));
  unwrap(await IdbStarred.add(entries.alopex));
  unwrap(await IdbStarred.remove(entries.alopex.uri));
  unwrap(await IdbTags.remove(banquet.key));

  const state = await IdbBookmarks.getState();
  expect(state.starred).toEqual([expect.objectContaining({ uri: entries.alopex.uri, deleted: true })]);
  expect(state.tags).toEqual([expect.objectContaining({ key: banquet.key, deleted: true })]);
  expect(state.tagged).toEqual([expect.objectContaining({ uri: entries.rhinokeros.uri, deleted: true })]);

  // A tombstone keeps only the identity of the record.
  expect(state.starred[0]).toMatchObject({ word: "", excerpt: "" });
  expect(state.tags[0]).toMatchObject({ name: "", description: "" });
  expect(state.tagged[0]).toMatchObject({ word: "", excerpt: "" });

  // Each change has a later stamp.
  const [star] = state.starred;
  expect(star!.updatedAt > state.tags[0]!.createdAt).toBe(true);
  expect(state.tags[0]!.updatedAt > star!.updatedAt).toBe(true);
});

test("the order of the tags is part of the state", async () => {
  const a = unwrap(await IdbTags.add({ name: "Eschyle" }));
  const b = unwrap(await IdbTags.add({ name: "Sophocle" }));
  unwrap(await IdbTags.reorder([a.key, b.key]));

  expect((await IdbBookmarks.getState()).tagOrder?.keys).toEqual([a.key, b.key]);
});

test("merge applies a remote state", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  unwrap(await IdbStarred.add(entries.alopex));

  const remote: BookmarksState = {
    tags: [{ key: "remote-tag", name: "Lysis", description: "", color: "Green", createdAt: remoteStamp(1), updatedAt: remoteStamp(1) }],
    tagged: [{ tagKey: "remote-tag", uri: "philia", word: "φιλία", excerpt: "φιλία amitié", updatedAt: remoteStamp(1) }],
    // The favorite removed on the other device, later.
    starred: [{ ...entries.alopex, excerpt: entries.alopex.excerpt, updatedAt: remoteStamp(Date.now() + 60_000), deleted: true }],
    tagOrder: null,
  };

  unwrap(await IdbBookmarks.merge(remote));

  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual([banquet.name, "Lysis"]);
  expect(await IdbTaggedEntry.get("philia", "remote-tag")).toMatchObject({ word: "φιλία" });
  expect(await IdbStarred.getAll()).toEqual([]);

  // Merging again changes nothing.
  const state = await IdbBookmarks.getState();
  expect(unwrap(await IdbBookmarks.merge(remote)).changed).toBe(false);
  expect(await IdbBookmarks.getState()).toEqual(state);
});

test("after a merge, local changes supersede the merged ones", async () => {
  // A remote stamp an hour ahead of this device's clock.
  const ahead = Date.now() + 3_600_000;
  unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ ...entries.alopex, excerpt: entries.alopex.excerpt, updatedAt: remoteStamp(ahead) }],
    tagOrder: null,
  }));

  unwrap(await IdbStarred.remove(entries.alopex.uri));
  const [star] = (await IdbBookmarks.getState()).starred;
  expect(star).toMatchObject({ deleted: true });
  expect(parseStamp(star!.updatedAt)!.time).toBeGreaterThanOrEqual(ahead);
});

test("merge fuses homonymous tags", async () => {
  const local = unwrap(await IdbTags.add({ name: "Homère" }));
  unwrap(await IdbTaggedEntry.add(entries.rhinokeros, local.key));

  // Created later on another device, with an entry.
  unwrap(await IdbBookmarks.merge({
    tags: [{ key: "remote-tag", name: "homere", description: "", color: "Rose", createdAt: remoteStamp(Date.now() + 1_000), updatedAt: remoteStamp(Date.now() + 1_000) }],
    tagged: [{ tagKey: "remote-tag", uri: "philia", word: "φιλία", excerpt: "φιλία amitié", updatedAt: remoteStamp(Date.now() + 1_000) }],
    starred: [],
    tagOrder: null,
  }));

  expect((await IdbTags.getAll()).map(tag => tag.key)).toEqual([local.key]);
  expect((await IdbTaggedEntry.getAll()).map(entry => [entry.tagKey, entry.uri]).sort()).toEqual([
    [local.key, "philia"],
    [local.key, entries.rhinokeros.uri],
  ]);
});

test("restore brings back what an exported state contains, even deleted since", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  unwrap(await IdbTaggedEntry.add(entries.rhinokeros, banquet.key));
  unwrap(await IdbStarred.add(entries.alopex));
  const backup = await IdbBookmarks.getState();

  // Everything deleted, then a tag created with the same name as another.
  unwrap(await IdbStarred.remove(entries.alopex.uri));
  unwrap(await IdbTags.remove(banquet.key));
  const other = unwrap(await IdbTags.add({ name: "Lysis" }));

  expect(unwrap(await IdbBookmarks.restore(backup)).changed).toBe(true);
  expect((await IdbTags.getAll()).map(tag => tag.name).sort()).toEqual(["Banquet", "Lysis"]);
  expect(await IdbTaggedEntry.get(entries.rhinokeros.uri, banquet.key)).not.toBeNull();
  expect(await IdbStarred.get(entries.alopex.uri)).not.toBeNull();
  expect((await IdbTags.getAll()).some(tag => tag.key === other.key)).toBe(true);

  // Restoring again changes nothing.
  expect(unwrap(await IdbBookmarks.restore(backup)).changed).toBe(false);
});

test("restore does not undo later changes, nor delete anything", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  const backup = await IdbBookmarks.getState();
  unwrap(await IdbTags.update(banquet.key, { name: "Le Banquet" }));
  unwrap(await IdbStarred.add(entries.alopex));

  // A backup that holds a deletion (older files kept the tombstones).
  const withDeletion: BookmarksState = {
    ...backup,
    starred: [{ ...entries.alopex, excerpt: entries.alopex.excerpt, updatedAt: remoteStamp(Date.now() + 60_000), deleted: true }],
  };
  unwrap(await IdbBookmarks.restore(withDeletion));

  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual(["Le Banquet"]);
  expect(await IdbStarred.get(entries.alopex.uri)).not.toBeNull();
});

test("join: online bookmarks deleted here come back", async () => {
  unwrap(await IdbStarred.add(entries.alopex));
  const online = await IdbBookmarks.getState();
  unwrap(await IdbStarred.remove(entries.alopex.uri));

  expect(unwrap(await IdbBookmarks.join(online)).changed).toBe(true);
  expect(await IdbStarred.get(entries.alopex.uri)).not.toBeNull();
});

test("the tombstones old enough are forgotten", async () => {
  const day = 24 * 60 * 60 * 1000;
  const db = await Idb.getIndexedDB();
  await db.put(IdbStore.Starred, { uri: "old", word: "", excerpt: "", updatedAt: remoteStamp(Date.now() - 100 * day), deleted: true });
  await db.put(IdbStore.Starred, { uri: "recent", word: "", excerpt: "", updatedAt: remoteStamp(Date.now() - 10 * day), deleted: true });
  unwrap(await IdbStarred.add(entries.alopex));

  expect(unwrap(await IdbBookmarks.compact()).changed).toBe(false);
  expect((await IdbBookmarks.getState()).starred.map(record => record.uri)).toEqual([entries.alopex.uri, "recent"].sort());

  // Nor are they brought back by a merge.
  unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ uri: "older", word: "", excerpt: "", updatedAt: remoteStamp(Date.now() - 200 * day), deleted: true }],
    tagOrder: null,
  }));
  expect((await IdbBookmarks.getState()).starred.map(record => record.uri)).toEqual([entries.alopex.uri, "recent"].sort());
});

test("a merge keeps the bookmarks within the limits: the later additions are left out", async () => {
  Idb.configure({ tagMaxItems: 2 });
  unwrap(await IdbStarred.add(entries.alopex));
  unwrap(await IdbStarred.add(entries.rhinokeros));

  // Added on another device, later, while this one was full.
  const outcome = unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ uri: "philia", word: "φιλία", excerpt: "φιλία amitié", updatedAt: remoteStamp(Date.now() + 60_000) }],
    tagOrder: null,
  }));

  expect(outcome.dropped).toEqual({ tags: 0, entries: 1 });
  expect((await IdbStarred.getAll()).map(entry => entry.uri).sort()).toEqual([entries.alopex.uri, entries.rhinokeros.uri].sort());
  expect((await IdbBookmarks.getState()).starred.find(record => record.uri === "philia")).toMatchObject({ deleted: true });
});
