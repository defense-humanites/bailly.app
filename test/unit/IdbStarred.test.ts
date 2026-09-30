import { expect, test } from "vitest";
import { entries, error, invalid, success } from "../idbHelpers";
import { Idb, IdbStarred } from "../../app/idb";

test("Create starred entry", async () => {
  // Acceptable values.
  expect(await IdbStarred.add(entries.rhinokeros)).toSatisfy(success);
  expect(await IdbStarred.add(entries.alopex)).toSatisfy(success);
  expect(await IdbStarred.add({ word: "foo", uri: "foo", excerpt: "foo" })).toSatisfy(success);
  expect(await IdbStarred.add(invalid({ word: "bar", uri: "bar", children: [{}] }))).toSatisfy(success); // Children must have length, but values are not checked.

  // Wrong values.
  expect(await IdbStarred.add(entries.rhinokeros)).toSatisfy(error); // Name exists.
  expect(await IdbStarred.add(invalid({ word: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add(invalid({ uri: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add(invalid({ excerpt: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add(invalid({ word: "foo", uri: "", excerpt: "" }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({ word: "", uri: "foo", excerpt: "" }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({ word: "", uri: "", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({ word: "qux", uri: "qux", excerpt: "" }))).toSatisfy(success); // Excerpt not known yet.
  expect(await IdbStarred.add(invalid({ word: "foo", uri: "", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({ word: "", uri: "foo", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({ word: "", uri: "foo", children: [] }))).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add(invalid({}))).toSatisfy(error); // Bad values.

  Idb.configure({ tagMaxItems: 1 });
  expect(await IdbStarred.add({ word: "baz", uri: "baz", excerpt: "baz" })).toSatisfy(error); // Too many starred entries.
});

test("Delete starred entry", async () => {
  await IdbStarred.add(entries.rhinokeros);

  expect(await IdbStarred.remove(entries.rhinokeros.uri)).toSatisfy(success);
  expect(await IdbStarred.remove("unknown")).toSatisfy(error);
});

test("Get starred entries", async () => {
  await IdbStarred.add(entries.rhinokeros);
  expect(await IdbStarred.get(entries.rhinokeros.uri)).toBeTypeOf("object");
  expect(await IdbStarred.get("unknown")).toBe(null);

  expect(await IdbStarred.getAll()).toHaveLength(1);
  await IdbStarred.add(entries.alopex);
  expect(await IdbStarred.getAll()).toHaveLength(2);
  // The latest added first; added again, first.
  expect((await IdbStarred.getAll()).map(entry => entry.uri)).toEqual([entries.alopex.uri, entries.rhinokeros.uri]);
  await IdbStarred.remove(entries.rhinokeros.uri);
  await IdbStarred.add(entries.rhinokeros);
  expect((await IdbStarred.getAll()).map(entry => entry.uri)).toEqual([entries.rhinokeros.uri, entries.alopex.uri]);
});
