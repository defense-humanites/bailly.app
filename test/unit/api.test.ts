import { expect, test } from "vitest";
import { sortLookupEntries, toApiQuery } from "../../shared/utils/api";

test("toApiQuery", () => {
  expect(toApiQuery({
    fields: ["word", "uri", "excerpt"],
    siblings: true,
    morphology: false,
    lengthRange: [600, 700],
    limit: 30,
    inputMode: "betacode",
    offset: undefined,
  })).toEqual({
    fields: "word,uri,excerpt",
    siblings: "true",
    morphology: "false",
    lengthRange: "600,700",
    limit: "30",
    inputMode: "betacode",
  });

  // An open range.
  expect(toApiQuery({ lengthRange: [600, undefined] })).toEqual({ lengthRange: "600" });
});

test("sortLookupEntries", () => {
  const entries = [
    { word: "a", isExact: false },
    { word: "b", isExact: true },
    { word: "c", isExact: false },
    { word: "d", isExact: true },
  ];

  expect(sortLookupEntries(entries).map(entry => entry.word)).toEqual(["b", "d", "a", "c"]);
  expect(entries.map(entry => entry.word)).toEqual(["a", "b", "c", "d"]); // Not mutated.
});
