import { expect, test } from "vitest";
import { InputMode } from "../../app/enums";
import { normalizeSearchGreek } from "../../shared/utils/searchGreek";
import { convertSearchInput, hasWildcards, isLemmatizable, toLookupQuery, toPositionedQuery, toSearchGreek, toSearchQuery } from "../../app/utils/searchInput";

/**
 * Types the input one character at a time, as in the search bar.
 */
const type = (input: string): string => {
  let value = "";
  for (const character of input) value = toSearchGreek(value + character);
  return value;
};

test("converts Beta Code letters", () => {
  expect(toSearchGreek("logos")).toBe("λογος");
  expect(toSearchGreek("LOGOS")).toBe("λογος");
  expect(toSearchGreek("hqcywxf")).toBe("ηθξψωχφ");
  expect(toSearchGreek("vergon")).toBe("ϝεργον"); // Digamma.
  expect(toSearchGreek("logos ergon")).toBe("λογος εργον");
});

test("converts Beta Code diacritics and capitals", () => {
  expect(toSearchGreek("h(me/ra")).toBe("ἡμέρα");
  expect(toSearchGreek("a)nh/r")).toBe("ἀνήρ");
  expect(toSearchGreek("*)aqh=nai")).toBe("Ἀθῆναι");
  expect(toSearchGreek("*swkra/ths")).toBe("Σωκράτης");
  expect(toSearchGreek("a(/|")).toBe("ᾅ");
  expect(toSearchGreek("i+/")).toBe("ΐ");
  expect(toSearchGreek("r(")).toBe("ῥ");
});

test("adds a diacritic to a letter already converted", () => {
  expect(toSearchGreek("α)")).toBe("ἀ");
  expect(toSearchGreek("ἀ/")).toBe("ἄ");
  expect(toSearchGreek("ανη/")).toBe("ανή");
});

test("keeps a diacritic waiting for its letter, like a dead key", () => {
  expect(toSearchGreek(")")).toBe("᾿");
  expect(toSearchGreek("*")).toBe("*");
  expect(toSearchGreek("*)")).toBe("*᾿");
  expect(toSearchGreek("*)/")).toBe("*᾿´");
  expect(toSearchGreek("*᾿α")).toBe("Ἀ");
  expect(toSearchGreek(")a")).toBe("ἀ");
  expect(toSearchGreek("λ)")).toBe("λ᾿"); // λ can't take a breathing.
  expect(toSearchGreek("a))")).toBe("ἀ᾿"); // α already has one.
});

test("leaves alone a diacritic its letter can't take", () => {
  expect(toSearchGreek(")s")).toBe("᾿ς");
  expect(toSearchGreek("*=o")).toBe("῀Ο");
  expect(toSearchGreek(") log")).toBe("᾿ λογ");
});

test("drops the position metacharacters (a search option now)", () => {
  expect(toSearchGreek("^log")).toBe("λογ");
  expect(toSearchGreek("log$")).toBe("λογ");
  expect(toSearchGreek("\"logos\"")).toBe("λογος");
  expect(toSearchGreek("log-os")).toBe("λογ-ος");
});

test("adds the metacharacters of the position", () => {
  expect(toPositionedQuery("λογος", "start")).toBe("λογος");
  expect(toPositionedQuery("λογ", "contains")).toBe("*λογ");
  expect(toPositionedQuery("λογος", "end")).toBe("λογος$");
  expect(toPositionedQuery("λογος", "exact")).toBe("\"λογος\"");
  expect(toPositionedQuery("", "end")).toBe("");
});

test("looks inflected forms up for whole words only", () => {
  expect(isLemmatizable("start")).toBe(true);
  expect(isLemmatizable("exact")).toBe(true);
  expect(isLemmatizable("contains")).toBe(false);
  expect(isLemmatizable("end")).toBe(false);
  expect(isLemmatizable("start", true)).toBe(false); // Wildcards.
});

test("keeps the wildcards within a word", () => {
  expect(toSearchGreek("l?gos")).toBe("λ?γος");
  expect(toSearchGreek("fil*os")).toBe("φιλ*ος");
  expect(toSearchGreek("*swkra/ths")).toBe("Σωκράτης"); // Capital mark.
  expect(toSearchGreek("a?*n")).toBe("α?*ν");
  expect(toSearchGreek("lo/g?s")).toBe("λόγ?ς");
  expect(toSearchGreek("?")).toBe("?");
  expect(type("fil*os")).toBe("φιλ*ος");
  expect(type("l?gos")).toBe("λ?γος");
  expect(type("*)aqh=nai")).toBe("Ἀθῆναι");
  expect(hasWildcards("φιλ*ος")).toBe(true);
  expect(hasWildcards("λόγος")).toBe(false);
});

test("sends the wildcards, not the pending capital marks", () => {
  expect(toSearchQuery("φιλ*ος")).toBe("φιλ*ος");
  expect(toSearchQuery("λ?γος")).toBe("λ?γος");
  expect(toSearchQuery("*᾿")).toBe("");
  expect(toSearchQuery("λογ *")).toBe("λογ");
});

test("keeps the wildcards of transliterated input", () => {
  expect(toLookupQuery("l?gos", InputMode.Transliteration)).toBe("λ?γος");
  expect(toLookupQuery("phil*os", InputMode.Transliteration)).toBe("φιλ*ος");
  expect(toLookupQuery("ph?*os", InputMode.Transliteration)).toBe("φ?*ος");
  expect(toLookupQuery("*anthrōpos", InputMode.Transliteration)).toBe("ἀνθρωπος");
  expect(convertSearchInput("φιλ*ος", InputMode.Transliteration)).toBe("phil*os");
  expect(convertSearchInput("phil*os", InputMode.BetaCode)).toBe("φιλ*ος");
});

test("handles input typed one character at a time", () => {
  expect(type("logosa ergon")).toBe("λογοσα εργον");
  expect(type("h(me/ra")).toBe("ἡμέρα");
  expect(type("*)aqh=nai")).toBe("Ἀθῆναι");
  expect(type("a)/|")).toBe("ᾄ");
  expect(type("*)/anqrwpos")).toBe("Ἄνθρωπος");
});

test("normalizes Greek (typed or pasted)", () => {
  expect(toSearchGreek("λόγος")).toBe("λόγος");
  expect(toSearchGreek("ἄνθρωπος")).toBe("ἄνθρωπος");
  expect(toSearchGreek("ά")).toBe("ά"); // Oxia → tonos (NFC).
  expect(normalizeSearchGreek("ϐιοσ ϲωμα")).toBe("βιος σωμα");
  expect(normalizeSearchGreek("λογοςα")).toBe("λογοσα");
});

test("leaves out of the query what waits for a letter", () => {
  expect(toSearchQuery("*")).toBe("");
  expect(toSearchQuery("*᾿")).toBe("");
  expect(toSearchQuery("λογ*")).toBe("λογ*"); // A wildcard, after a letter.
  expect(toSearchQuery("᾿ς")).toBe("ς");
  expect(toSearchQuery("ἀνήρ")).toBe("ἀνήρ");
});

test("converts transliterated input when looked up", () => {
  expect(toLookupQuery("lógos", InputMode.Transliteration)).toBe("λόγος");
  expect(toLookupQuery("hēméra", InputMode.Transliteration)).toBe("ἡμέρα");
  expect(toLookupQuery("psychḗ", InputMode.Transliteration)).toBe("ψυχή");
  expect(toLookupQuery("logos$", InputMode.Transliteration)).toBe("λογος");
  expect(toLookupQuery("λόγος", InputMode.Transliteration)).toBe("λόγος"); // Greek is accepted.
  expect(toLookupQuery("λόγος", InputMode.BetaCode)).toBe("λόγος");
  expect(toLookupQuery("*᾿", InputMode.BetaCode)).toBe("");
});

test("converts the input when the input mode changes", () => {
  expect(convertSearchInput("λόγος", InputMode.Transliteration)).toBe("lógos");
  expect(convertSearchInput("ἡμέρα", InputMode.Transliteration)).toBe("hēméra");
  expect(convertSearchInput("lógos", InputMode.BetaCode)).toBe("λόγος");
});
