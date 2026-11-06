import { describe, expect, test, vi } from "vitest";
import { legacySearchForm, legacySearchLocation, resolveLegacySearch, type LegacyLookup, type LegacyLookupEntry } from "../../server/lib/legacySearch";

const headword = (uri: string): LegacyLookupEntry => ({ uri, isExact: true, isMorpheus: false });
const lemma = (uri: string): LegacyLookupEntry => ({ uri, isExact: true, isMorpheus: true });
const other = (uri: string): LegacyLookupEntry => ({ uri, isExact: false, isMorpheus: false });

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

describe("resolveLegacySearch", () => {
  test("the headwords of the strictest attempt win", async () => {
    const lookup = vi.fn<LegacyLookup>().mockResolvedValue([headword("ana_(2)"), lemma("anax"), other("anabainô")]);
    expect(await resolveLegacySearch("ἄνα", lookup)).toEqual(["ana_(2)"]);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith("ἄνα", { caseSensitive: true, diacriticSensitive: true });
  });

  test("looser attempts, until a headword is found", async () => {
    const lookup = vi.fn<LegacyLookup>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([lemma("eimi_(1)")])
      .mockResolvedValueOnce([headword("anêr")]);
    expect(await resolveLegacySearch("ανηρ", lookup)).toEqual(["anêr"]);
    expect(lookup).toHaveBeenLastCalledWith("ανηρ", { caseSensitive: false, diacriticSensitive: false });
  });

  test("without any headword, the lemmas of the first attempt that finds some", async () => {
    const lookup = vi.fn<LegacyLookup>()
      .mockResolvedValueOnce([lemma("polis"), lemma("polus"), other("poleis")])
      .mockResolvedValueOnce([lemma("polis"), lemma("Polis"), lemma("polus")])
      .mockResolvedValueOnce([]);
    expect(await resolveLegacySearch("πόλεις", lookup)).toEqual(["polis", "polus"]);
  });

  test("nothing found", async () => {
    expect(await resolveLegacySearch("ξξ", () => Promise.resolve([other("xenos")]))).toEqual([]);
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

  test("several entries: the reader, titled with the form", () => {
    expect(legacySearchLocation("χάρις", ["charis", "Charis"]))
      .toBe(`/forme/${encodeURIComponent("χάρις")}?q=charis%2CCharis`);
  });
});
