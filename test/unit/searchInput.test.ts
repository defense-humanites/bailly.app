import { expect, test } from "vitest";
import { normalizeSearchGreek, toSearchGreek, toSearchQuery } from "../../app/utils/searchInput";

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
  expect(toSearchGreek("lo?gos")).toBe("λο̣γος"); // Underdot.
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
  expect(toSearchGreek("?")).toBe(""); // No spacing underdot.
});

test("keeps the search metacharacters", () => {
  expect(toSearchGreek("^log")).toBe("^λογ");
  expect(toSearchGreek("log$")).toBe("λογ$");
  expect(toSearchGreek("\"logos\"")).toBe("\"λογος\"");
  expect(toSearchGreek("log-os")).toBe("λογ-ος");
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
  expect(toSearchQuery("λογ*")).toBe("λογ");
  expect(toSearchQuery("᾿ς")).toBe("ς");
  expect(toSearchQuery("ἀνήρ")).toBe("ἀνήρ");
});
