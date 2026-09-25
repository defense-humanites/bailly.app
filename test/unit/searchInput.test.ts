import { expect, test } from "vitest";
import { normalizeSearchGreek, toSearchGreek, toSearchQuery } from "../../app/utils/searchInput";

test("converts Beta Code", () => {
  expect(toSearchGreek("logos")).toBe("λογος");
  expect(toSearchGreek("LOGOS")).toBe("λογος");
  expect(toSearchGreek("hqcywxf")).toBe("ηθξψωχφ");
  expect(toSearchGreek("vergon")).toBe("ϝεργον"); // Digamma.
  expect(toSearchGreek("h(me/ra")).toBe("ημερα"); // Diacritics are dropped.
  expect(toSearchGreek("logos ergon")).toBe("λογος εργον");
});

test("converts capitals and drops diacritics", () => {
  expect(toSearchGreek("*)aqh=nai")).toBe("Αθηναι");
  expect(toSearchGreek("*swkra/ths")).toBe("Σωκρατης");
  expect(toSearchGreek("*os")).toBe("Ος");
  expect(toSearchGreek("a(/|")).toBe("α");
  expect(toSearchGreek("i+")).toBe("ι");
  expect(toSearchGreek("lo?gos")).toBe("λογος"); // Underdot.
});

test("drops the diacritics typed after a converted letter", () => {
  expect(toSearchGreek("α)")).toBe("α");
  expect(toSearchGreek("ημε/")).toBe("ημε");
  expect(toSearchGreek(")")).toBe("");
});

test("keeps a capital mark until its letter comes", () => {
  expect(toSearchGreek("*")).toBe("*");
  expect(toSearchGreek("*)")).toBe("*");
  expect(toSearchGreek("*λογος")).toBe("Λογος");
  expect(toSearchQuery("*")).toBe("");
  expect(toSearchQuery("λογ*")).toBe("λογ");
});

test("keeps the search metacharacters", () => {
  expect(toSearchGreek("^log")).toBe("^λογ");
  expect(toSearchGreek("log$")).toBe("λογ$");
  expect(toSearchGreek("\"logos\"")).toBe("\"λογος\"");
  expect(toSearchGreek("log-os")).toBe("λογ-ος");
});

test("handles input typed one character at a time", () => {
  const type = (input: string): string => {
    let value = "";
    for (const character of input) value = toSearchGreek(value + character);
    return value;
  };
  expect(type("logosa ergon")).toBe("λογοσα εργον");
  expect(type("h(me/ra")).toBe("ημερα");
  expect(type("*)aqh=nai")).toBe("Αθηναι");
  expect(type("a)/|")).toBe("α");
});

test("normalizes Greek (typed or pasted)", () => {
  expect(toSearchGreek("λόγος")).toBe("λογος");
  expect(toSearchGreek("ἄνθρωπος")).toBe("ανθρωπος");
  expect(normalizeSearchGreek("ϐιοσ ϲωμα")).toBe("βιος σωμα");
  expect(normalizeSearchGreek("λογοςα")).toBe("λογοσα");
});
