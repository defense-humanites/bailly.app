import { expect, test } from "vitest";
import { error, invalid, success, tags, unwrap } from "../idbHelpers";
import { Idb, IdbTaggedEntry, IdbTags } from "../../app/idb";
import type { IdbTagCreation } from "../../app/idb";

test("Create tag", async () => {
  // Acceptable values.
  expect(await IdbTags.add(tags.banquet)).toSatisfy(success);
  expect(await IdbTags.add(tags.theetete)).toSatisfy(success);
  const createPhedonTag = await IdbTags.add({ name: "Phédon", description: "De l'âme", color: invalid("unknown") });
  expect(createPhedonTag).toSatisfy(success);
  expect(IdbTags.isColorKey(unwrap(createPhedonTag).color)).toBe(true); // A valid color must have been picked.

  // Wrong values.
  expect(await IdbTags.add({ name: "" })).toSatisfy(error); // Name is mandatory.
  expect(await IdbTags.add({ name: "Favoris" })).toSatisfy(error); // Name is reserved.
  expect(await IdbTags.add({ name: "Banquet" })).toSatisfy(error); // Already used.
  expect(await IdbTags.add({ name: "theetete" })).toSatisfy(error); // Already used (case/diacritics are ignored).
  expect(await IdbTags.add(invalid({}))).toSatisfy(error); // Bad values.

  Idb.configure({ maxTags: 1 });
  expect(await IdbTags.add({ name: "foo" })).toSatisfy(error); // Too many tags.
});

test("Update tag", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = unwrap(banquetTag).key;
  const theeteteTagKey = unwrap(theeteteTag).key;

  // Acceptable values.
  const newData: IdbTagCreation = { name: "Les Acharniens", description: "Pièce de théâtre d'Aristophane", color: "Orange" };
  expect(await IdbTags.update(banquetTagKey, newData)).toSatisfy(success);
  const updatedTag = await IdbTags.update(banquetTagKey, { ...newData, color: invalid("unknown") });
  expect(updatedTag).toSatisfy(success);
  expect(IdbTags.isColorKey(unwrap(updatedTag).color)).toBe(true); // A valid color must have been picked.

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

  const keys = { a: unwrap(tagA).key, b: unwrap(tagB).key, c: unwrap(tagC).key };

  // Acceptable values.
  expect(await IdbTags.reorder(Object.values(keys))).toSatisfy(success); // Same order.
  expect(await IdbTags.reorder([keys.c, keys.a, keys.b])).toSatisfy(success);

  // Wrong values.
  expect(await IdbTags.reorder([keys.b, keys.a, keys.c, keys.a])).toSatisfy(error); // Too many keys.
  expect(await IdbTags.reorder([keys.b, keys.a, keys.c, "unknown"])).toSatisfy(error); // Too many keys, including different keys.
  expect(await IdbTags.reorder([keys.b, keys.a, "unknown"])).toSatisfy(error); // Different keys.
  expect(await IdbTags.reorder([keys.b, keys.a])).toSatisfy(error); // Partial keys.
  expect(await IdbTags.reorder([])).toSatisfy(error);
});

test("Delete tag", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const timeeTag = await IdbTags.add({ name: "Timée" });
  const banquetTagKey = unwrap(banquetTag).key;
  const theeteteTagKey = unwrap(theeteteTag).key;
  const timeeTagKey = unwrap(timeeTag).key;

  expect(await IdbTags.remove(banquetTagKey)).toSatisfy(success);
  expect(await IdbTags.remove(theeteteTagKey)).toSatisfy(success);
  expect(await IdbTags.remove(timeeTagKey)).toSatisfy(success);
  expect(await IdbTags.getAll()).toHaveLength(0);

  expect(await IdbTags.remove("unknown")).toSatisfy(error);
});

test("Delete tag detaches its entries", async () => {
  const banquetTagKey = unwrap(await IdbTags.add(tags.banquet)).key;
  const theeteteTagKey = unwrap(await IdbTags.add(tags.theetete)).key;

  await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, banquetTagKey);
  await IdbTaggedEntry.add({ word: "bar", uri: "bar", excerpt: "bar" }, banquetTagKey);
  await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, theeteteTagKey);

  expect(await IdbTags.remove(banquetTagKey)).toSatisfy(success);

  // Only the entry attached to the remaining tag is left.
  expect(await IdbTaggedEntry.getAll()).toEqual([
    expect.objectContaining({ uri: "foo", tagKey: theeteteTagKey }),
  ]);
});

test("Tag colors", async () => {
  // `Yellow` is reserved for the favorites: a valid tag color is picked instead.
  const tag = await IdbTags.add({ name: "Lachès", color: invalid("Yellow") });
  expect(tag).toSatisfy(success);
  expect(IdbTags.isColorKey(unwrap(tag).color)).toBe(true);

  // Picked colors are valid and, while some remain, not already used.
  const usedColors = new Set<string>([unwrap(tag).color]);
  for (const name of ["a", "b", "c", "d", "e"]) {
    const data = unwrap(await IdbTags.add({ name }));
    expect(IdbTags.isColorKey(data.color)).toBe(true);
    expect(usedColors.has(data.color)).toBe(false);
    usedColors.add(data.color);
  }
});

test("Get tags", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const banquetTagKey = unwrap(banquetTag).key;

  expect(await IdbTags.get(unwrap(banquetTag).name)).toBeTypeOf("object");
  expect(await IdbTags.get("unknown")).toBe(null);

  expect(await IdbTags.getAll()).toHaveLength(1);

  const theeteteTag = await IdbTags.add(tags.theetete);
  expect(await IdbTags.getAll()).toHaveLength(2);

  await IdbTags.reorder([banquetTagKey, unwrap(theeteteTag).key]);
  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual(["Banquet", "Théétète"]);
});

test("Get entry tags / tag keys (involves IdbTaggedEntry)", async () => {
  const banquetTag = await IdbTags.add(tags.banquet);
  const theeteteTag = await IdbTags.add(tags.theetete);
  const banquetTagKey = unwrap(banquetTag).key;
  const theeteteTagKey = unwrap(theeteteTag).key;

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
  expect(fooEntryTags?.[0]).toMatchObject({ key: banquetTagKey, name: "Banquet" });
  expect(barEntryTags?.[0]).toMatchObject({ key: banquetTagKey, name: "Banquet" });

  await IdbTaggedEntry.add({ word: "foo", uri: "foo", excerpt: "foo" }, theeteteTagKey);

  const updatedFooEntryTags = await IdbTags.getEntryTags("foo");
  const updatedFooEntryTagKeys = await IdbTags.getEntryTagKeys("foo");

  expect(updatedFooEntryTags).toHaveLength(2);
  expect(updatedFooEntryTagKeys).toHaveLength(2);
  // In the user's order (the latest created tag first).
  expect(updatedFooEntryTags).toEqual([
    expect.objectContaining({ key: theeteteTagKey, name: "Théétète", color: "Blue" }),
    expect.objectContaining({ key: banquetTagKey, name: "Banquet", color: "Rose" }),
  ]);
  expect(updatedFooEntryTagKeys).toEqual([theeteteTagKey, banquetTagKey]);

  Idb.configure({ tagMaxItems: 1 });
  await IdbTaggedEntry.add({ word: "bar", uri: "bar", excerpt: "bar" }, theeteteTagKey);

  const updatedBarEntryTags = await IdbTags.getEntryTags("bar");
  const updatedBarEntryTagKeys = await IdbTags.getEntryTagKeys("bar");

  expect(updatedBarEntryTags).toHaveLength(1);
  expect(updatedBarEntryTagKeys).toHaveLength(1);
  expect(updatedBarEntryTags).toEqual([
    expect.objectContaining({ key: banquetTagKey, name: "Banquet", color: "Rose" }),
  ]);
  expect(updatedBarEntryTagKeys).toEqual([banquetTagKey]);
});

test("New tags are placed first", async () => {
  const a = unwrap(await IdbTags.add({ name: "Eschyle" }));
  const b = unwrap(await IdbTags.add({ name: "Sophocle" }));
  const c = unwrap(await IdbTags.add({ name: "Euripide" }));

  expect((await IdbTags.getAll()).map(tag => tag.key)).toEqual([c.key, b.key, a.key]);

  // Also once the tags have been arranged: the order does not list the new tag.
  unwrap(await IdbTags.reorder([a.key, b.key, c.key]));
  const d = unwrap(await IdbTags.add({ name: "Aristophane" }));
  expect((await IdbTags.getAll()).map(tag => tag.key)).toEqual([d.key, a.key, b.key, c.key]);
});

test("Tag keys are UUIDs", async () => {
  const tag = unwrap(await IdbTags.add(tags.banquet));
  expect(tag.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("Update keeps omitted values", async () => {
  const banquet = unwrap(await IdbTags.add(tags.banquet));

  const renamed = unwrap(await IdbTags.update(banquet.key, { name: "Le Banquet" }));
  expect(renamed).toMatchObject({
    name: "Le Banquet",
    description: banquet.description,
    color: banquet.color,
    createdAt: banquet.createdAt,
  });

  expect(await IdbTags.update("unknown", { name: "Timée" })).toSatisfy(error); // Unknown tag.
});

test("Reorder rejects duplicate keys", async () => {
  const a = unwrap(await IdbTags.add({ name: "Eschyle" }));
  const b = unwrap(await IdbTags.add({ name: "Sophocle" }));
  unwrap(await IdbTags.add({ name: "Euripide" }));

  expect(await IdbTags.reorder([a.key, b.key, a.key])).toSatisfy(error);
});
