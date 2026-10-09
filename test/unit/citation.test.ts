import { describe, expect, it } from "vitest";
import { accessDate, citedLemma, clipboardHtml, entryCitation, versionDate, workCitation } from "../../app/utils/citation";

const NBSP = " ";
// Spaces made visible: the references put non-breaking ones where French
// typography wants them.
const plain = (text: string): string => text.replaceAll(NBSP, " ");

const logos = { word: "λόγος", uri: "logos" };
const oudos2 = { word: "οὐδός", uri: "oudos#2" };
const accessed = new Date(2026, 9, 5, 23, 30);

describe("dates", () => {
  it("in French, « 1er » for the first day of a month", () => {
    expect(plain(versionDate("2023-02-28"))).toBe("28 février 2023");
    expect(plain(versionDate("2023-03-01"))).toBe("1er mars 2023");
    expect(plain(accessDate(new Date(2026, 9, 1)))).toBe("1er octobre 2026");
  });

  it("the date of consultation is the reader's day", () => {
    expect(plain(accessDate(accessed))).toBe("5 octobre 2026");
  });
});

describe("citedLemma", () => {
  it("a homonym preceded by its number, as in M. Gréco's edition", () => {
    expect(citedLemma(logos)).toBe("λόγος");
    expect(plain(citedLemma(oudos2))).toBe("2 οὐδός");
  });
});

describe("entryCitation", () => {
  it("a full note: the version, the lemma, the address, the date of consultation", () => {
    const { text, html } = entryCitation("note", logos, "apa", { accessed });
    expect(plain(text)).toBe("A. Bailly, Dictionnaire grec-français, éd. G. Gréco, Bailly 2020 – Hugo Chávez, version du 28 février 2023, s. v. « λόγος », https://bailly.app/logos (consulté le 5 octobre 2026).");
    expect(html).toContain("<i>Dictionnaire grec-français</i>");
  });

  it("a homonym's address with its anchor", () => {
    expect(plain(entryCitation("note", oudos2, "apa", { accessed }).text)).toContain("s. v. « 2 οὐδός », https://bailly.app/oudos#2 ");
  });

  it("a short note", () => {
    expect(plain(entryCitation("short", logos, "mla", { accessed }).text)).toBe("Bailly 2020, s. v. « λόγος ».");
  });

  it("author-date: the version's year, APA's comma, a colon otherwise", () => {
    expect(plain(entryCitation("authorDate", logos, "apa", { accessed }).text)).toBe("(Bailly, 2023, s. v. λόγος)");
    expect(plain(entryCitation("authorDate", oudos2, "iso", { accessed }).text)).toBe("(Bailly, 2023 : s. v. 2 οὐδός)");
  });

  it("another version of the data", () => {
    expect(plain(entryCitation("note", logos, "apa", { version: "2027-01-15", accessed }).text)).toContain("version du 15 janvier 2027");
    expect(entryCitation("authorDate", logos, "apa", { version: "2027-01-15", accessed }).text).toContain("2027");
  });
});

describe("workCitation", () => {
  it("in the four styles, the title in italics", () => {
    for (const style of ["apa", "mla", "iso", "chicago"] as const) {
      const { text, html } = workCitation(style, { accessed });
      expect(text).toContain("Dictionnaire grec-français");
      expect(html).toContain("<i>Dictionnaire grec-français</i>");
      expect(plain(text)).toContain("version du 28 février 2023");
    }
  });

  it("APA", () => {
    expect(plain(workCitation("apa", { accessed }).text)).toBe("Bailly, A. (2023). Dictionnaire grec-français (G. Gréco, Dir.; nouv. éd. rev. et corr., dite Bailly 2020 – Hugo Chávez, version du 28 février 2023). https://bailly.app (Ouvrage original publié en 1894)");
  });

  it("MLA and ISO 690 with the date of consultation; MLA's container in italics", () => {
    expect(plain(workCitation("mla", { accessed }).text)).toContain("Consulté le 5 octobre 2026.");
    expect(workCitation("mla", { accessed }).html).toContain("<i>Bailly.app</i>, Association pour la défense des humanités, bailly.app.");
    expect(plain(workCitation("iso", { accessed }).text)).toContain("Disponible à l'adresse : https://bailly.app [consulté le 5 octobre 2026].");
  });
});

describe("clipboardHtml", () => {
  it("as is, but in a common serif font for WebKit", () => {
    expect(clipboardHtml("A. Bailly, <i>Dictionnaire</i>", false)).toBe("A. Bailly, <i>Dictionnaire</i>");
    expect(clipboardHtml("A. Bailly, <i>Dictionnaire</i>", true))
      .toBe("<span style=\"font-family: 'Times New Roman', serif\">A. Bailly, <i>Dictionnaire</i></span>");
  });
});
