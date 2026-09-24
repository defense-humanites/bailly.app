import { expect, test } from "vitest";
import { entries, error, success } from "../idbHelpers";
import { Idb, IdbStarred } from "../../app/idb";

test("Create starred entry", async () => {
  // Acceptable values.
  expect(await IdbStarred.add(entries.rhinokeros)).toSatisfy(success);
  expect(await IdbStarred.add(entries.alopex)).toSatisfy(success);
  expect(await IdbStarred.add({ word: "foo", uri: "foo", excerpt: "foo" })).toSatisfy(success);
  expect(await IdbStarred.add({ word: "bar", uri: "bar", children: [{}] })).toSatisfy(success); // Children must have length, but values are not checked.

  // Wrong values.
  expect(await IdbStarred.add(entries.rhinokeros)).toSatisfy(error); // Name exists.
  expect(await IdbStarred.add({ word: "foo" })).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add({ uri: "foo" })).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add({ excerpt: "foo" })).toSatisfy(error); // Missing fields.
  expect(await IdbStarred.add({ word: "foo", uri: "", excerpt: "" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "", uri: "foo", excerpt: "" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "", uri: "", excerpt: "foo" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "foo", uri: "foo", excerpt: "" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "foo", uri: "", excerpt: "foo" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "", uri: "foo", excerpt: "foo" })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({ word: "", uri: "foo", children: [] })).toSatisfy(error); // Bad values.
  expect(await IdbStarred.add({})).toSatisfy(error); // Bad values.
  
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
});