import { expect, test } from "vitest";
import { highlightEntryInExcerpt, pickRandom } from "../../app/helpers";

test("pickRandom", () => {
  for (let i = 0; i < 20; i++) {
    expect(["a", "b", "c"]).toContain(pickRandom(["a", "b", "c"]));
    expect(pickRandom(["a", "b", "c"], ["a", "c"])).toBe("b");
  }
  expect(() => pickRandom(["a"], ["a"])).toThrow();
  expect(() => pickRandom([])).toThrow();
});

test("highlightEntryInExcerpt", () => {
  const html = (rest: string) => `<span class="font-semibold">ῥινόκερως</span>${rest}`;

  // The middle dot inside the word is not part of the separated word.
  expect(highlightEntryInExcerpt("ῥινόκερως", "ῥινό·κερως, ωτος (ὁ)")).toBe(html(", ωτος (ὁ)"));
  // Special characters after the word must not shift the cut.
  expect(highlightEntryInExcerpt("ῥινόκερως", "ῥινό·κερως, ω·τος *x")).toBe(html(", ω·τος *x"));
  expect(highlightEntryInExcerpt("ῥινόκερως", "*ῥινόκερως, ωτος")).toBe(html(", ωτος"));
});
