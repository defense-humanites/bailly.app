import { expect, test } from "vitest";
import { entries, tags, unwrap } from "../idbHelpers";
import { IdbBookmarks, IdbStarred, IdbTaggedEntry, IdbTags, type BookmarksState } from "../../app/idb";
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
  unwrap(await IdbBookmarks.merge(remote));
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
