import { describe, expect, test } from "vitest";
import { legacySearchForm, legacySearchLocation } from "../../server/lib/legacySearch";

describe("legacySearchForm", () => {
  test("reads the Greek form of a former search path", () => {
    expect(legacySearchForm(`/q=${encodeURIComponent("λόγος")}`)).toBe("λόγος");
    expect(legacySearchForm("/q=λόγος/")).toBe("λόγος");
    expect(legacySearchForm(`/q=${encodeURIComponent("Ἀθῆναι")}`)).toBe("Ἀθῆναι");
  });

  test("normalizes the form (NFC, letter variants, final sigma)", () => {
    expect(legacySearchForm(`/q=${encodeURIComponent("λόγοσ".normalize("NFD"))}`)).toBe("λόγος");
    expect(legacySearchForm("/q=ϐίοσ")).toBe("βίος");
  });

  test("ignores the other paths", () => {
    expect(legacySearchForm("/logos")).toBeUndefined();
    expect(legacySearchForm("/q=λόγος/autre")).toBeUndefined();
    expect(legacySearchForm("/lecteur")).toBeUndefined();
  });

  test("rejects what isn't a Greek word", () => {
    expect(legacySearchForm("/q=")).toBeNull();
    expect(legacySearchForm("/q=logos")).toBeNull();
    expect(legacySearchForm("/q=λόγος%20καί")).toBeNull();
    expect(legacySearchForm("/q=%E0%A4%A")).toBeNull();
    expect(legacySearchForm(`/q=${"α".repeat(51)}`)).toBeNull();
  });
});

describe("legacySearchLocation", () => {
  test("an entry: its page", () => {
    expect(legacySearchLocation("λόγος", ["logos"])).toBe("/logos");
    expect(legacySearchLocation("ἦν", ["ên_(2)"])).toBe(`/${encodeURIComponent("ên")}_(2)`);
  });

  test("a homonym: its anchor in the page", () => {
    expect(legacySearchLocation("οὐδός", ["oudos#2"])).toBe("/oudos#2");
  });

  test("several entries: the form's page, which finds them by itself", () => {
    expect(legacySearchLocation("χαρις", ["charis", "Charis"]))
      .toBe(`/forme/${encodeURIComponent("χαρις")}`);
  });
});
