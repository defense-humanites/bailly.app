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

test("Pin and unpin tags", async () => {
  const a = unwrap(await IdbTags.add({ name: "Sophocle" }));
  const b = unwrap(await IdbTags.add({ name: "Eschyle" }));
  const c = unwrap(await IdbTags.add({ name: "Euripide" }));
  const names = async () => (await IdbTags.getAll()).map(tag => tag.name);

  // Not pinned: by name.
  expect(await names()).toEqual(["Eschyle", "Euripide", "Sophocle"]);

  // Pinned first, in the order of their pinning.
  const pinnedA = unwrap(await IdbTags.pin(a.key, true));
  expect(pinnedA.pinnedAt).toBeDefined();
  expect(pinnedA.pinnedAt! > a.createdAt).toBe(true);
  unwrap(await IdbTags.pin(c.key, true));
  expect(await names()).toEqual(["Sophocle", "Euripide", "Eschyle"]);

  // Pinning again changes nothing (not even its place).
  expect(unwrap(await IdbTags.pin(a.key, true))).toEqual(pinnedA);
  expect(await names()).toEqual(["Sophocle", "Euripide", "Eschyle"]);

  // Unpinned: back among the others, the pinning removed.
  const unpinned = unwrap(await IdbTags.pin(a.key, false));
  expect(unpinned).not.toHaveProperty("pinnedAt");
  expect(await names()).toEqual(["Euripide", "Eschyle", "Sophocle"]);
  // Renaming keeps the pinning.
  expect(unwrap(await IdbTags.update(c.key, { name: "Euripide (pièces)" })).pinnedAt).toBeDefined();

  expect(await IdbTags.pin("unknown", true)).toSatisfy(error);
  unwrap(await IdbTags.remove(b.key));
  expect(await IdbTags.pin(b.key, true)).toSatisfy(error);
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

  expect(await IdbTags.get(unwrap(banquetTag).name)).toBeTypeOf("object");
  expect(await IdbTags.get("unknown")).toBe(null);

  expect(await IdbTags.getAll()).toHaveLength(1);

  const theeteteTag = await IdbTags.add(tags.theetete);
  expect(await IdbTags.getAll()).toHaveLength(2);

  await IdbTags.pin(unwrap(theeteteTag).key, true);
  expect((await IdbTags.getAll()).map(tag => tag.name)).toEqual(["Théétète", "Banquet"]);
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
  // In the order of the tags (none pinned: by name).
  expect(updatedFooEntryTags).toEqual([
    expect.objectContaining({ key: banquetTagKey, name: "Banquet", color: "Rose" }),
    expect.objectContaining({ key: theeteteTagKey, name: "Théétète", color: "Blue" }),
  ]);
  expect(updatedFooEntryTagKeys).toEqual([banquetTagKey, theeteteTagKey]);

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

test("New tags are not pinned, and take their place by name", async () => {
  const a = unwrap(await IdbTags.add({ name: "Sophocle" }));
  unwrap(await IdbTags.pin(a.key, true));
  const b = unwrap(await IdbTags.add({ name: "Eschyle" }));
  expect(b).not.toHaveProperty("pinnedAt");
  expect((await IdbTags.getAll()).map(tag => tag.key)).toEqual([a.key, b.key]);
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

test("the description of a tag is limited", async () => {
  const max = IdbTags.descriptionMaxLength;
  // Counted in characters (a Greek letter with accents is one character).
  const longest = "ἄ".repeat(max);
  const tag = unwrap(await IdbTags.add({ name: "Homère", description: ` ${longest} ` }));
  expect(tag.description).toBe(longest);

  expect(await IdbTags.add({ name: "Platon", description: `${longest}x` })).toEqual({
    state: "error",
    message: `La description d'une étiquette ne peut dépasser ${max} caractères.`,
  });
  expect(await IdbTags.update(tag.key, { name: "Homère", description: `${longest}x` })).toSatisfy(error);
  expect((await IdbTags.getAll())[0]?.description).toBe(longest);

  expect(IdbTags.clampDescription(`${longest} et plus`)).toBe(longest);
});

test("the name of a tag is limited", async () => {
  const max = IdbTags.nameMaxLength;
  const longest = "Ἀ".repeat(max);
  const tag = unwrap(await IdbTags.add({ name: longest }));
  expect(tag.name).toBe(longest);

  expect(await IdbTags.add({ name: `${longest}x` })).toEqual({
    state: "error",
    message: `Le nom d'une étiquette ne peut dépasser ${max} caractères.`,
  });
  expect(await IdbTags.update(tag.key, { name: `${longest}x` })).toSatisfy(error);
  expect(IdbTags.clampName(`  ${longest} et plus`)).toBe(longest);
});
