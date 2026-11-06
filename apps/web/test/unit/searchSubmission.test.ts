import { describe, expect, test } from "vitest";
import { searchSubmissionForm } from "../../server/lib/searchSubmission";

describe("searchSubmissionForm", () => {
  test("converts Beta Code, as the search bar does", () => {
    expect(searchSubmissionForm("lo/gos", undefined)).toBe("λόγος");
    expect(searchSubmissionForm("logos", undefined)).toBe("λογος");
    expect(searchSubmissionForm(" a)nh/r ", undefined)).toBe("ἀνήρ");
  });

  test("converts a transliteration", () => {
    expect(searchSubmissionForm("lógos", "transliteration")).toBe("λόγος");
  });

  test("accepts Greek, whatever the mode", () => {
    expect(searchSubmissionForm("λόγος", undefined)).toBe("λόγος");
    expect(searchSubmissionForm("λόγος", "transliteration")).toBe("λόγος");
  });

  test("an empty input, or not a whole Greek word", () => {
    expect(searchSubmissionForm("  ", undefined)).toBeUndefined();
    expect(searchSubmissionForm(undefined, undefined)).toBeUndefined();
    expect(searchSubmissionForm(["a", "b"], undefined)).toBeUndefined();
    expect(searchSubmissionForm("l?gos", undefined)).toBeNull();
    expect(searchSubmissionForm("123", undefined)).toBeNull();
  });
});
