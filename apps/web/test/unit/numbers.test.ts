import { describe, expect, it } from "vitest";
import { formatCount } from "~/utils/numbers";

describe("formatCount", () => {
  it("leaves numbers below 1000 as they are", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(30)).toBe("30");
    expect(formatCount(999)).toBe("999");
  });

  it("separates the groups of three digits with a narrow no-break space", () => {
    expect(formatCount(1234)).toBe("1 234");
    expect(formatCount(12345)).toBe("12 345");
    expect(formatCount(1234567)).toBe("1 234 567");
  });
});
