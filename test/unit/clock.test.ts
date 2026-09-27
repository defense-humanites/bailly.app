import { expect, test } from "vitest";
import { formatStamp, isStamp, maxStamp, nextStamp, parseStamp, stampTime } from "../../app/idb/clock";

test("stamps sort in temporal order", () => {
  const a = formatStamp({ time: 999, counter: 35, node: "b" });
  const b = formatStamp({ time: 1000, counter: 0, node: "a" });
  const c = formatStamp({ time: 1000, counter: 1, node: "a" });
  expect([c, b, a].sort()).toEqual([a, b, c]);
  expect(parseStamp(c)).toEqual({ time: 1000, counter: 1, node: "a" });
  expect(stampTime(c)).toBe(1000);
  expect(isStamp("nope")).toBe(false);
});

test("nextStamp follows the clock, never goes backwards, and exceeds the latest stamp", () => {
  const first = nextStamp(undefined, "a", 1000);
  expect(parseStamp(first)).toEqual({ time: 1000, counter: 0, node: "a" });

  // Later wall clock.
  expect(parseStamp(nextStamp(first, "a", 2000))).toEqual({ time: 2000, counter: 0, node: "a" });

  // Same millisecond, or a wall clock behind: the counter increments.
  const second = nextStamp(first, "a", 1000);
  const third = nextStamp(second, "a", 500);
  expect(second > first && third > second).toBe(true);
  expect(parseStamp(third)).toEqual({ time: 1000, counter: 2, node: "a" });

  // After a stamp observed from another device, ahead of this one's clock.
  const remote = formatStamp({ time: 5000, counter: 3, node: "b" });
  expect(nextStamp(maxStamp(third, remote), "a", 1200) > remote).toBe(true);
});

test("maxStamp", () => {
  expect(maxStamp()).toBeUndefined();
  expect(maxStamp(undefined, "0000000000002-0000-a", "0000000000001-0000-b")).toBe("0000000000002-0000-a");
});
