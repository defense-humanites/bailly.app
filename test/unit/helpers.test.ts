import { expect, test } from "vitest";
import { pickRandom } from "../../app/helpers";

test("pickRandom", () => {
  for (let i = 0; i < 20; i++) {
    expect(["a", "b", "c"]).toContain(pickRandom(["a", "b", "c"]));
    expect(pickRandom(["a", "b", "c"], ["a", "c"])).toBe("b");
  }
  expect(() => pickRandom(["a"], ["a"])).toThrow();
  expect(() => pickRandom([])).toThrow();
});
