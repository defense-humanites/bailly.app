import { expect, test } from "vitest";
import { entries, error, invalid, success, tags, unwrap } from "../idbHelpers";
import { Idb, IdbTaggedEntry, IdbTags } from "../../app/idb";

test("Create tagged entry", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = unwrap(banquetTag).key;
  const theeteteTagKey = unwrap(theeteteTag).key;

  // Acceptable values.
  expect(await IdbTaggedEntry.add(entries.rhinokeros, banquetTagKey)).toSatisfy(success);
  expect(await IdbTaggedEntry.add(entries.rhinokeros, theeteteTagKey)).toSatisfy(success);
  expect(await IdbTaggedEntry.add(entries.alopex, banquetTagKey)).toSatisfy(success);

  expect(await IdbTaggedEntry.add(entries.alopex, theeteteTagKey)).toSatisfy(success);

  expect(await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, banquetTagKey)).toSatisfy(success);
  expect(await IdbTaggedEntry.add(invalid({ word: "bar", uri: "bar", children: [{}] }), banquetTagKey)).toSatisfy(success); // Children must have length, but values are not checked.

  // Wrong values.
  expect(await IdbTaggedEntry.add(entries.rhinokeros, banquetTagKey)).toSatisfy(error); // Name exists.
  expect(await IdbTaggedEntry.add(invalid({ word: "foo" }), banquetTagKey)).toSatisfy(error); // Missing fields.
  expect(await IdbTaggedEntry.add(invalid({ uri: "foo" }), banquetTagKey)).toSatisfy(error); // Missing fields.
  expect(await IdbTaggedEntry.add(invalid({ excerpt: "foo" }), banquetTagKey)).toSatisfy(error); // Missing fields.
  expect(await IdbTaggedEntry.add(invalid({ word: "foo", uri: "", excerpt: "" }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({ word: "", uri: "foo", excerpt: "" }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({ word: "", uri: "", excerpt: "foo" }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({ word: "qux", uri: "qux", excerpt: "" }), banquetTagKey)).toSatisfy(success); // Excerpt not known yet.
  expect(await IdbTaggedEntry.add(invalid({ word: "foo", uri: "", excerpt: "foo" }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({ word: "", uri: "foo", excerpt: "foo" }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({ word: "", uri: "foo", children: [] }), banquetTagKey)).toSatisfy(error); // Bad values.
  expect(await IdbTaggedEntry.add(invalid({}), banquetTagKey)).toSatisfy(error); // Bad values.

  expect(await IdbTaggedEntry.add(entries.alopex, "unknown")).toSatisfy(error); // Unknown tag.

  Idb.configure({ tagMaxItems: 1 });
  expect(await IdbTaggedEntry.add({ word: "baz", uri: "baz", excerpt: "baz" }, banquetTagKey)).toSatisfy(error); // Too many tagged entries.
});

test("Delete tagged entry", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const banquetTagKey = unwrap(banquetTag).key;

  await IdbTaggedEntry.add(entries.rhinokeros, banquetTagKey);

  expect(await IdbTaggedEntry.remove(entries.rhinokeros.uri, "unknown")).toSatisfy(error);
  expect(await IdbTaggedEntry.remove("unknown", banquetTagKey)).toSatisfy(error);

  expect(await IdbTaggedEntry.remove(entries.rhinokeros.uri, banquetTagKey)).toSatisfy(success);
});

test("Get tagged entries", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = unwrap(banquetTag).key;
  const theeteteTagKey = unwrap(theeteteTag).key;

  await IdbTaggedEntry.add(entries.rhinokeros, banquetTagKey);
  await IdbTaggedEntry.add(entries.alopex, banquetTagKey);
  await IdbTaggedEntry.add(entries.rhinokeros, theeteteTagKey);

  expect(await IdbTaggedEntry.get(entries.rhinokeros.uri, banquetTagKey)).toBeTypeOf("object");
  expect(await IdbTaggedEntry.get(entries.rhinokeros.uri, "unknown")).toBe(null);
  expect(await IdbTaggedEntry.get("unknown", banquetTagKey)).toBe(null);

  expect(await IdbTaggedEntry.getAll()).toHaveLength(3);
  // The latest added first.
  expect((await IdbTaggedEntry.getAll()).map(entry => [entry.uri, entry.tagKey])).toEqual([
    [entries.rhinokeros.uri, theeteteTagKey],
    [entries.alopex.uri, banquetTagKey],
    [entries.rhinokeros.uri, banquetTagKey],
  ]);

  await IdbTaggedEntry.remove(entries.rhinokeros.uri, banquetTagKey);
  expect(await IdbTaggedEntry.getAll()).toHaveLength(2);

  // Added again: as a new addition, first.
  await IdbTaggedEntry.add(entries.rhinokeros, banquetTagKey);
  expect((await IdbTaggedEntry.getAll())[0]).toMatchObject({ uri: entries.rhinokeros.uri, tagKey: banquetTagKey });
});
