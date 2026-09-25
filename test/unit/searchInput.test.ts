import { expect, test } from "vitest";
import { normalizeSearchGreek, toSearchGreek } from "../../app/utils/searchInput";

test("converts Beta Code", () => {
  expect(toSearchGreek("logos")).toBe("λογος");
  expect(toSearchGreek("LOGOS")).toBe("λογος");
  expect(toSearchGreek("hqcywxf")).toBe("ηθξψωχφ");
  expect(toSearchGreek("vergon")).toBe("ϝεργον"); // Digamma.
  expect(toSearchGreek("h(me/ra")).toBe("ημερα"); // Diacritics are dropped.
  expect(toSearchGreek("logos ergon")).toBe("λογος εργον");
});

test("keeps the search metacharacters", () => {
  expect(toSearchGreek("^log")).toBe("^λογ");
  expect(toSearchGreek("log$")).toBe("λογ$");
  expect(toSearchGreek("lo?os")).toBe("λο?ος");
  expect(toSearchGreek("*os")).toBe("*ος");
  expect(toSearchGreek("\"logos\"")).toBe("\"λογος\"");
  expect(toSearchGreek("log-os")).toBe("λογ-ος");
});

test("handles input typed one character at a time", () => {
  let value = "";
  for (const character of "logosa ergon") value = toSearchGreek(value + character);
  expect(value).toBe("λογοσα εργον");
});

test("normalizes Greek (typed or pasted)", () => {
  expect(toSearchGreek("λόγος")).toBe("λογος");
  expect(toSearchGreek("ἄνθρωπος")).toBe("ανθρωπος");
  expect(normalizeSearchGreek("ϐιοσ ϲωμα")).toBe("βιος σωμα");
  expect(normalizeSearchGreek("λογοςα")).toBe("λογοσα");
});
