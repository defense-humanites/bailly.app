import { expect, test } from "vitest";
import { entries, tags, unwrap } from "../idbHelpers";
import { Idb, IdbBookmarks, IdbMetaKey, IdbStarred, IdbStore, IdbTaggedEntry, IdbTags, type BookmarksState } from "../../app/idb";
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
  expect(state.starred[0]).toMatchObject({ word: "" });
  expect(state.starred[0]).not.toHaveProperty("excerpt");
  expect(state.tags[0]).toMatchObject({ name: "", description: "" });
  expect(state.tagged[0]).toMatchObject({ word: "" });
  expect(state.tagged[0]).not.toHaveProperty("excerpt");

  // Each change has a later stamp.
  const [star] = state.starred;
  expect(star!.updatedAt > state.tags[0]!.createdAt).toBe(true);
  expect(state.tags[0]!.updatedAt > star!.updatedAt).toBe(true);
});

test("the pinning of the tags is part of the state", async () => {
  const a = unwrap(await IdbTags.add({ name: "Eschyle" }));
  const pinned = unwrap(await IdbTags.pin(a.key, true));

  expect((await IdbBookmarks.getState()).tags).toEqual([expect.objectContaining({ key: a.key, pinnedAt: pinned.pinnedAt })]);
});

test("merge applies a remote state", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  unwrap(await IdbStarred.add(entries.alopex));

  const remote: BookmarksState = {
    tags: [{ key: "remote-tag", name: "Lysis", description: "", color: "Green", createdAt: remoteStamp(1), updatedAt: remoteStamp(1) }],
    tagged: [{ tagKey: "remote-tag", uri: "philia", word: "φιλία", updatedAt: remoteStamp(1) }],
    // The favorite removed on the other device, later.
    starred: [{ uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: remoteStamp(Date.now() + 60_000), deleted: true }],
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
    starred: [{ uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: remoteStamp(ahead) }],
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
    tagged: [{ tagKey: "remote-tag", uri: "philia", word: "φιλία", updatedAt: remoteStamp(Date.now() + 1_000) }],
    starred: [],
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

test("restore brings the entries back in their order of addition, after the stamps of the file", async () => {
  // A file from a device whose clock is ahead (within the drift allowed).
  const ahead = Date.now() + 60_000;
  const backup: BookmarksState = {
    tags: [],
    tagged: [],
    starred: [
      { uri: entries.rhinokeros.uri, word: entries.rhinokeros.word, updatedAt: remoteStamp(ahead - 2) },
      { uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: remoteStamp(ahead - 1) },
    ],
  };
  // Deleted here in the meantime.
  unwrap(await IdbStarred.add(entries.rhinokeros));
  unwrap(await IdbStarred.remove(entries.rhinokeros.uri));
  unwrap(await IdbStarred.add({ word: "foo", uri: "foo", excerpt: "foo" }));

  unwrap(await IdbBookmarks.restore(backup));
  // The latest added first: the file's order kept, the local entry older.
  expect((await IdbStarred.getAll()).map(entry => entry.uri)).toEqual([entries.alopex.uri, entries.rhinokeros.uri, "foo"]);
  const { starred } = await IdbBookmarks.getState();
  for (const record of starred.filter(record => record.uri !== "foo")) {
    expect(record.addedAt).toBeDefined();
    expect(record.updatedAt > record.addedAt! && record.updatedAt > remoteStamp(ahead - 1)).toBe(true);
  }
});

test("restore does not follow the stamps of the file's tombstones", async () => {
  const farAhead = Date.now() + 60 * 60 * 1000;
  unwrap(await IdbBookmarks.restore({
    tags: [],
    tagged: [],
    starred: [
      { uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: remoteStamp(Date.now() - 1000) },
      { uri: entries.rhinokeros.uri, word: "", updatedAt: remoteStamp(farAhead), deleted: true },
    ],
  }));
  const [restored] = (await IdbBookmarks.getState()).starred;
  expect(restored!.uri).toBe(entries.alopex.uri);
  expect(parseStamp(restored!.updatedAt)!.time).toBeLessThan(farAhead);
});

test("restore does not undo later changes, nor delete anything", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));
  const backup = await IdbBookmarks.getState();
  unwrap(await IdbTags.update(banquet.key, { name: "Le Banquet" }));
  unwrap(await IdbStarred.add(entries.alopex));

  // A backup that holds a deletion (older files kept the tombstones).
  const withDeletion: BookmarksState = {
    ...backup,
    starred: [{ uri: entries.alopex.uri, word: entries.alopex.word, updatedAt: remoteStamp(Date.now() + 60_000), deleted: true }],
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

test("join: this device's earlier deletions are forgotten, so that they delete nothing elsewhere", async () => {
  unwrap(await IdbStarred.add(entries.alopex));
  unwrap(await IdbStarred.remove(entries.alopex.uri));
  unwrap(await IdbStarred.add(entries.rhinokeros));

  // E.g. a locker the server emptied: nothing online.
  unwrap(await IdbBookmarks.join({ tags: [], tagged: [], starred: [] }));
  expect((await IdbBookmarks.getState()).starred.map(record => record.uri)).toEqual([entries.rhinokeros.uri]);
});

test("the tombstones old enough are forgotten", async () => {
  const day = 24 * 60 * 60 * 1000;
  const db = await Idb.getIndexedDB();
  await db.put(IdbStore.Starred, { uri: "old", word: "", updatedAt: remoteStamp(Date.now() - 100 * day), deleted: true });
  await db.put(IdbStore.Starred, { uri: "recent", word: "", updatedAt: remoteStamp(Date.now() - 10 * day), deleted: true });
  unwrap(await IdbStarred.add(entries.alopex));

  expect(unwrap(await IdbBookmarks.compact()).changed).toBe(false);
  expect((await IdbBookmarks.getState()).starred.map(record => record.uri)).toEqual([entries.alopex.uri, "recent"].sort());

  // Nor are they brought back by a merge.
  unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ uri: "older", word: "", updatedAt: remoteStamp(Date.now() - 200 * day), deleted: true }],
  }));
  expect((await IdbBookmarks.getState()).starred.map(record => record.uri)).toEqual([entries.alopex.uri, "recent"].sort());
});

test("a merge beyond the limits is not applied", async () => {
  Idb.configure({ tagMaxItems: 2 });
  unwrap(await IdbStarred.add(entries.alopex));
  unwrap(await IdbStarred.add(entries.rhinokeros));
  const before = await IdbBookmarks.getState();

  // Added on another device while this one was full.
  const outcome = unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ uri: "philia", word: "φιλία", updatedAt: remoteStamp(Date.now() + 60_000) }],
  }));

  // To remove: this device's own favorites (the other device's is not here).
  expect(outcome).toMatchObject({ changed: false, excesses: [{ kind: "entries", tag: null, count: 3, local: [entries.alopex.word, entries.rhinokeros.word] }] });
  expect(await IdbBookmarks.getState()).toEqual(before);
});

test("an import leaves out what exceeds the limits, and deletes nothing", async () => {
  Idb.configure({ tagMaxItems: 2 });
  unwrap(await IdbStarred.add(entries.alopex));
  const imported: BookmarksState = {
    tags: [],
    tagged: [],
    starred: [
      { uri: "philia", word: "φιλία", updatedAt: remoteStamp(1) },
      { uri: "eros", word: "ἔρως", updatedAt: remoteStamp(2) },
    ],
  };

  expect(await IdbBookmarks.previewRestore(imported)).toEqual({ tags: 0, entries: 1 });
  const outcome = unwrap(await IdbBookmarks.restore(imported));
  expect(outcome.skipped).toEqual({ tags: 0, entries: 1 });
  expect((await IdbStarred.getAll()).map(entry => entry.uri).sort()).toEqual([entries.alopex.uri, "philia"].sort());
});

test("the excerpts are kept apart: those known here stay, the missing ones are filled, the unused ones forgotten", async () => {
  unwrap(await IdbStarred.add(entries.alopex));
  unwrap(await IdbBookmarks.merge({
    tags: [],
    tagged: [],
    starred: [{ uri: "philia", word: "φιλία", updatedAt: remoteStamp(Date.now() + 60_000) }],
  }));

  expect(await IdbStarred.get(entries.alopex.uri)).toMatchObject({ excerpt: entries.alopex.excerpt });
  expect(await IdbStarred.get("philia")).toMatchObject({ excerpt: "" });
  expect(await IdbBookmarks.missingExcerpts()).toEqual(["philia"]);

  const before = await IdbBookmarks.getState();
  expect(unwrap(await IdbBookmarks.fillExcerpts(new Map([["philia", "φιλία amitié"], ["unknown", "…"]]))).changed).toBe(true);
  expect(await IdbStarred.get("philia")).toMatchObject({ excerpt: "φιλία amitié" });
  expect(await IdbBookmarks.missingExcerpts()).toEqual([]);
  // Not a change of the bookmarks: nothing stamped; nothing kept for an entry not bookmarked.
  expect(await IdbBookmarks.getState()).toEqual(before);
  expect([...(await IdbBookmarks.getExcerpts()).keys()].sort()).toEqual([entries.alopex.uri, "philia"].sort());

  // No longer bookmarked: its excerpt is forgotten at the next visit.
  unwrap(await IdbStarred.remove(entries.alopex.uri));
  unwrap(await IdbBookmarks.compact());
  expect([...(await IdbBookmarks.getExcerpts()).keys()]).toEqual(["philia"]);
});

test("the reference time for the received stamps follows the logical clock", async () => {
  expect(Math.abs(await IdbBookmarks.referenceTime() - Date.now())).toBeLessThan(1_000);

  // Changes observed from a device two days ahead: this device's clock is
  // late, but it no longer rejects them.
  const ahead = Date.now() + 2 * 24 * 60 * 60 * 1000;
  const db = await Idb.getIndexedDB();
  await db.put(IdbStore.Meta, remoteStamp(ahead), IdbMetaKey.Clock);
  expect(await IdbBookmarks.referenceTime()).toBe(ahead);
});
