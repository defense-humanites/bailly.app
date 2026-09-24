import { expect, test } from "vitest";
import { entries, error, invalid, success } from "../idbHelpers";
import { Idb, IdbHistory } from "../../app/idb";

test("Create history entry", async () => {
  // Acceptable values.
  expect(await IdbHistory.add(entries.rhinokeros)).toSatisfy(success);
  expect(await IdbHistory.add(entries.alopex)).toSatisfy(success);
  expect(await IdbHistory.add({ word: "foo", uri: "foo", excerpt: "foo" })).toSatisfy(success);
  // Children must have length, but values are not checked.
  expect(await IdbHistory.add(invalid({ word: "bar", uri: "bar", children: [{}] }))).toSatisfy(success);
  // Pushing an existing entry should just change the entry position.
  expect(await IdbHistory.add(entries.rhinokeros)).toSatisfy(success);

  Idb.configure({ searchHistoryLength: 1 });
  // The entry creation must have deleted all other entries due to the history length settings.
  expect(await IdbHistory.add({ word: "baz", uri: "baz", excerpt: "baz" })).toSatisfy(success);

  // Wrong values.
  expect(await IdbHistory.add(invalid({ word: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbHistory.add(invalid({ uri: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbHistory.add(invalid({ excerpt: "foo" }))).toSatisfy(error); // Missing fields.
  expect(await IdbHistory.add(invalid({ word: "foo", uri: "", excerpt: "" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "", uri: "foo", excerpt: "" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "", uri: "", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "foo", uri: "foo", excerpt: "" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "foo", uri: "", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "", uri: "foo", excerpt: "foo" }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({ word: "", uri: "foo", children: [] }))).toSatisfy(error); // Bad values.
  expect(await IdbHistory.add(invalid({}))).toSatisfy(error); // Bad values.
});

test("Get history entries", async () => {
  await IdbHistory.add(entries.rhinokeros);
  await IdbHistory.add(entries.alopex);

  // Entries should be returned from newest to oldest.
  expect((await IdbHistory.get(1))[0]).toEqual(entries.alopex);

  await IdbHistory.add({ word: "foo", uri: "foo", excerpt: "foo" });
  // Pushing an existing entry should not increase the history length but just change the entry position.
  await IdbHistory.add({ word: "foo", uri: "foo", excerpt: "foo" });
  expect(await IdbHistory.get()).toHaveLength(3);

  expect(await IdbHistory.get(2)).toHaveLength(2);
  expect(await IdbHistory.get(1)).toHaveLength(1);

  expect(await IdbHistory.get(1.333)).toHaveLength(3);
  expect(await IdbHistory.get(invalid("bad value"))).toHaveLength(3);

  Idb.configure({ searchHistoryLength: 1 });
  // The entry creation must have deleted all other entries due to the history length settings.
  await IdbHistory.add({ word: "bar", uri: "bar", excerpt: "bar" });
  expect(await IdbHistory.get()).toHaveLength(1);
});

test("Clear history", async () => {
  await IdbHistory.add(entries.rhinokeros);
  await IdbHistory.add(entries.alopex);
  await IdbHistory.clear();

  expect(await IdbHistory.get()).toHaveLength(0);
});
