import { expect, test } from "vitest";
import { pickRandom, splitExcerpt } from "../../app/helpers";

test("pickRandom", () => {
  for (let i = 0; i < 20; i++) {
    expect(["a", "b", "c"]).toContain(pickRandom(["a", "b", "c"]));
    expect(pickRandom(["a", "b", "c"], ["a", "c"])).toBe("b");
  }
  expect(() => pickRandom(["a"], ["a"])).toThrow();
  expect(() => pickRandom([])).toThrow();
});

test("splitExcerpt", () => {
  const split = (rest: string, before = "") => ({ before, word: "ῥινόκερως", rest });

  // The middle dot inside the word is not part of the separated word.
  expect(splitExcerpt("ῥινόκερως", "ῥινό·κερως, ωτος (ὁ)")).toEqual(split(", ωτος (ὁ)"));
  // Special characters after the word must not shift the cut.
  expect(splitExcerpt("ῥινόκερως", "ῥινό·κερως, ω·τος *x")).toEqual(split(", ω·τος *x"));
  expect(splitExcerpt("ῥινόκερως", "*ῥινόκερως, ωτος")).toEqual(split(", ωτος"));
  // A homonym number.
  expect(splitExcerpt("ῥινόκερως", "2 ῥινόκερως, ωτος")).toEqual(split(", ωτος", "2 "));
  // Not found.
  expect(splitExcerpt("λόγος", "ῥινόκερως, ωτος")).toEqual({ before: "", word: "", rest: "ῥινόκερως, ωτος" });
});
