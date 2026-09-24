import { expect, test } from "vitest";
import { error, success, tags } from "../idbHelpers";
import { LocalStorageKey } from "../../app/enums";
import { Idb, IdbTaggedEntry, IdbTags } from "../../app/idb";

test("Create tag", async () => {
  // Acceptable values.
  expect(await IdbTags.add(tags.banquet)).toSatisfy(success);
  expect(await IdbTags.add(tags.theetete)).toSatisfy(success);
  const createPhedonTag = await IdbTags.add({ name: "Phédon", description: "De l'âme", color: "unknown" });
  expect(createPhedonTag).toSatisfy(success);
  expect(createPhedonTag).toSatisfy((tag) => tag.color !== "unknown"); // A valid color must have been picked.

  // Wrong values.
  expect(await IdbTags.add({ name: "" })).toSatisfy(error); // Name is mandatory.
  expect(await IdbTags.add({ name: "Favoris" })).toSatisfy(error); // Name is reserved.
  expect(await IdbTags.add({ name: "Banquet" })).toSatisfy(error); // Already used.
  expect(await IdbTags.add({ name: "theetete" })).toSatisfy(error); // Already used (case/diacritics are ignored).
  expect(await IdbTags.add({})).toSatisfy(error); // Bad values.

  Idb.configure({ maxTags: 1 });
  expect(await IdbTags.add({ name: "foo" })).toSatisfy(error); // Too many tags.
});

test("Update tag", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = banquetTag.data.key;
  const theeteteTagKey = theeteteTag.data.key;

  // Acceptable values.
  const newData = { name: "Les Acharniens", description: "Pièce de théâtre d'Aristophane", color: "Orange" };
  expect(await IdbTags.update(banquetTagKey, newData)).toSatisfy(success);
  const updatedTag = await IdbTags.update(banquetTagKey, { ...newData, color: "unknown" });
  expect(updatedTag).toSatisfy(success);
  expect(updatedTag).toSatisfy((tag) => tag.color !== "unknown"); // A valid color must have been picked.

  // Wrong values.
  expect(await IdbTags.update(theeteteTagKey, { name: "" })).toSatisfy(error); // Name is mandatory.
  expect(await IdbTags.update(theeteteTagKey, { name: "Favoris" })).toSatisfy(error); // Name is reserved.
  expect(await IdbTags.update(theeteteTagKey, { name: newData.name })).toSatisfy(error); // Already used.
  expect(await IdbTags.update(banquetTagKey, { name: "theetete" })).toSatisfy(error); // Already used (case/diacritics are ignored).
});

test("Reorder tags", async () => {
  const tagA = await IdbTags.add({ name: "Eschyle" });
  const tagB = await IdbTags.add({ name: "Sophocle" });
  const tagC = await IdbTags.add({ name: "Euripide" });

  const keys = { a: tagA.data.key, b: tagB.data.key, c: tagC.data.key };

  // Acceptable values.
  expect(await IdbTags.reorder(Object.values(keys))).toSatisfy(success); // Same order.
  expect(await IdbTags.reorder([keys.c, keys.a, keys.b])).toSatisfy(success);

  // Wrong values.
  expect(await IdbTags.reorder([keys.b, keys.a, keys.c, keys.a])).toSatisfy(error); // Too many keys.
  expect(await IdbTags.reorder([keys.b, keys.a, keys.c, 999])).toSatisfy(error); // Too many keys, including different keys.
  expect(await IdbTags.reorder([keys.b, keys.a, 999])).toSatisfy(error); // Different keys.
  expect(await IdbTags.reorder([keys.b, keys.a])).toSatisfy(error); // Partial keys.
  expect(await IdbTags.reorder([])).toSatisfy(error);
});

test("Delete tag", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const timeeTag = await IdbTags.add({ name: "Timée" });
  const banquetTagKey = banquetTag.data.key;
  const theeteteTagKey = theeteteTag.data.key;
  const timeeTagKey = timeeTag.data.key;

  expect(await IdbTags.remove(banquetTagKey)).toSatisfy(success);

  // Force to determine a current key.
  localStorage.removeItem(LocalStorageKey.CurrentTagKey);
  expect(await IdbTags.remove(theeteteTagKey)).toSatisfy(success);

  // Force to determine a current key (but there are no more entries left).
  localStorage.removeItem(LocalStorageKey.CurrentTagKey);
  expect(await IdbTags.remove(timeeTagKey)).toSatisfy(success);

  expect(await IdbTags.remove(999)).toSatisfy(error);
});

test("Get tags", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const banquetTagKey = banquetTag.data.key;

  expect(await IdbTags.get(banquetTag.data.name)).toBeTypeOf("object");
  expect(await IdbTags.get("unknown")).toBe(null);

  expect(await IdbTags.getAll()).toHaveLength(1);

  const theeteteTag = await IdbTags.add(tags.theetete);
  expect(await IdbTags.getAll()).toHaveLength(2);

  // Keys are not reset between tests (auto-increment), so use the actual ones.
  await IdbTags.reorder([theeteteTag.data.key, banquetTagKey]);
  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual(["Théétète", "Banquet"]); // Defaults to `orderBy: "position"`.
  expect((await IdbTags.getAll({ orderBy: "position" })).map(tag => tag.name)).toEqual(["Théétète", "Banquet"]);
  expect((await IdbTags.getAll({ orderBy: "insertion" })).map(tag => tag.name)).toEqual(["Banquet", "Théétète"]);
});

test("Get entry tags / tag keys (involves IdbTaggedEntry)", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = banquetTag.data.key;
  const theeteteTagKey = theeteteTag.data.key;

  await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, banquetTagKey);
  await IdbTaggedEntry.add({ word: "bar", uri: "bar", excerpt: "bar" }, banquetTagKey);

  const fooEntryTags = await IdbTags.getEntryTags("foo");
  const barEntryTags = await IdbTags.getEntryTags("bar");
  const fooEntryTagKeys = await IdbTags.getEntryTagKeys("foo");
  const barEntryTagKeys = await IdbTags.getEntryTagKeys("bar");

  expect(fooEntryTags).toHaveLength(1);
  expect(barEntryTags).toHaveLength(1);
  expect(fooEntryTagKeys).toEqual([banquetTagKey]);
  expect(barEntryTagKeys).toEqual([banquetTagKey]);
  expect(fooEntryTags?.[0]).toSatisfy(tag => tag.key === banquetTagKey);
  expect(barEntryTags?.[0]).toSatisfy(tag => tag.key === banquetTagKey);
  expect(fooEntryTags?.[0]).toSatisfy(tag => tag.name === "Banquet");
  expect(barEntryTags?.[0]).toSatisfy(tag => tag.name === "Banquet");

  await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, theeteteTagKey);

  const updatedFooEntryTags = await IdbTags.getEntryTags("foo");
  const updatedFooEntryTagKeys = await IdbTags.getEntryTagKeys("foo");

  expect(updatedFooEntryTags).toHaveLength(2);
  expect(updatedFooEntryTagKeys).toHaveLength(2);
  expect(updatedFooEntryTags).toEqual([
    expect.objectContaining({ key: banquetTagKey, name: "Banquet", color: "Rose" }),
    expect.objectContaining({ key: theeteteTagKey, name: "Théétète", color: "Blue" })
  ]);
  expect(updatedFooEntryTagKeys).toEqual([banquetTagKey, theeteteTagKey]);

  Idb.configure({ tagMaxItems: 1 });
  await IdbTaggedEntry.add({ word: "bar", uri: "bar", excerpt: "bar" }, theeteteTagKey);

  const updatedBarEntryTags = await IdbTags.getEntryTags("bar");
  const updatedBarEntryTagKeys = await IdbTags.getEntryTagKeys("bar");

  expect(updatedBarEntryTags).toHaveLength(1);
  expect(updatedBarEntryTagKeys).toHaveLength(1);
  expect(updatedBarEntryTags).toEqual([
    expect.objectContaining({ key: banquetTagKey, name: "Banquet", color: "Rose" })
  ]);
  expect(updatedBarEntryTagKeys).toEqual([banquetTagKey]);
});

test("Set current", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const banquetTagKey = banquetTag.data.key;

  expect(await IdbTags.setCurrent(banquetTagKey)).toSatisfy(success);
  expect(await IdbTags.setCurrent(999)).toSatisfy(error);
});
