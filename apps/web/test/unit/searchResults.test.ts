import { describe, expect, test } from "vitest";
import { searchResultGroups } from "../../app/utils/searchResults";

const entry = (uri: string, word: string, excerpt: string, isExact: boolean, isMorpheus = false) =>
  ({ uri, word, excerpt, isExact, isMorpheus });

describe("searchResultGroups", () => {
  test("the exact matches first, then the other entries, numbered in order", () => {
    const groups = searchResultGroups([
      entry("logos", "λόγος", "λόγος, ου (ὁ) parole", true),
      entry("logios", "λόγιος", "λόγιος, α, ον habile", false),
      entry("logo", "λογῶ", "λογῶ, ῶ compter", true, true),
    ]);
    expect(groups.map(group => group.label)).toEqual(["Correspondances exactes", "Autres entrées"]);
    expect(groups.flatMap(group => group.items.map(item => [item.index, item.uri]))).toEqual([[0, "logos"], [1, "logo"], [2, "logios"]]);
    expect(groups[0]!.items[0]).toMatchObject({ key: "logos", word: "λόγος", rest: ", ου (ὁ) parole", nested: false, isMorpheus: false });
    expect(groups[0]!.items[1]!.isMorpheus).toBe(true);
  });

  test("without exact matches, the entries alone; nothing without entries", () => {
    expect(searchResultGroups([entry("logios", "λόγιος", "λόγιος, α, ον", false)]).map(group => group.label)).toEqual(["Entrées"]);
    expect(searchResultGroups([])).toEqual([]);
  });

  test("homonyms under their common headword, numbered, keyed apart from it", () => {
    const [group] = searchResultGroups([{
      ...entry("oudos", "οὐδός", "", true),
      children: [
        { uri: "oudos#1", word: "οὐδός", excerpt: "οὐδός, οῦ (ὁ) seuil" },
        { uri: "oudos#2", word: "οὐδός", excerpt: "οὐδός, οῦ (ἡ) chemin" },
      ],
    }]);
    expect(group!.items.map(({ key, word, rest, nested, homonym }) => ({ key, word, rest, nested, homonym }))).toEqual([
      { key: "headword:oudos", word: "οὐδός", rest: "", nested: false, homonym: undefined },
      { key: "oudos#1", word: "οὐδός", rest: ", οῦ (ὁ) seuil", nested: true, homonym: "1" },
      { key: "oudos#2", word: "οὐδός", rest: ", οῦ (ἡ) chemin", nested: true, homonym: "2" },
    ]);
  });
});
