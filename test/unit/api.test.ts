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
    { word: "a", isExact: false, isMorpheus: false },
    { word: "b", isExact: true, isMorpheus: true },
    { word: "c", isExact: true, isMorpheus: false },
    { word: "d", isExact: false, isMorpheus: false },
    { word: "e", isExact: true, isMorpheus: false },
  ];

  expect(sortLookupEntries(entries).map(entry => entry.word)).toEqual(["c", "e", "b", "a", "d"]);
  expect(entries.map(entry => entry.word)).toEqual(["a", "b", "c", "d", "e"]); // Not mutated.
});
