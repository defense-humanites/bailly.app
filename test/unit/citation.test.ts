import { describe, expect, it } from "vitest";
import {
  accessDate, bibKey, biblatexEntry, biblatexFileName, citedLemma, clipboardHtml, entryCitation, entryCitationFormLabel, entryMetadata, isoDate, versionDate, workCitation,
} from "../../app/utils/citation";

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
  it("a homonym followed by its number in superscript, as Bailly.app shows it", () => {
    expect(citedLemma(logos)).toBe("λόγος");
    expect(citedLemma(oudos2)).toBe("οὐδός²");
  });
});

describe("entryCitation", () => {
  it("a full note: the version, the lemma, the address, the date of consultation", () => {
    const { text, html } = entryCitation("note", logos, "apa", { accessed });
    expect(plain(text)).toBe("A. Bailly, Dictionnaire grec-français, éd. G. Gréco, Bailly 2020 – Hugo Chávez, version du 28 février 2023, s. v. « λόγος », https://bailly.app/logos (consulté le 5 octobre 2026).");
    expect(html).toContain("<i>Dictionnaire grec-français</i>");
  });

  it("a homonym's address with its anchor", () => {
    expect(plain(entryCitation("note", oudos2, "apa", { accessed }).text)).toContain("s. v. « οὐδός² », https://bailly.app/oudos#2 ");
  });

  it("a short note", () => {
    expect(plain(entryCitation("short", logos, "mla", { accessed }).text)).toBe("Bailly 2020, s. v. « λόγος ».");
  });

  it("author-date: after the bibliography's style, the entry in quotation marks", () => {
    expect(plain(entryCitation("authorDate", logos, "apa", { accessed }).text)).toBe("(Bailly, 1894/2023, s. v. « λόγος »)");
    expect(plain(entryCitation("authorDate", logos, "chicago", { accessed }).text)).toBe("(Bailly [1894] 2023, s.v. « λόγος »)");
    expect(plain(entryCitation("authorDate", oudos2, "iso", { accessed }).text)).toBe("(Bailly, 2023 : s. v. « οὐδός² »)");
    expect(plain(entryCitation("authorDate", logos, "mla", { accessed }).text)).toBe("(Bailly, « λόγος »)");
    expect(entryCitationFormLabel("authorDate", "mla")).toBe("Dans le texte");
    expect(entryCitationFormLabel("authorDate", "apa")).toBe("Auteur-date");
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
      expect(plain(text)).toContain("28 février 2023");
    }
  });

  it("APA", () => {
    expect(plain(workCitation("apa", { accessed }).text)).toBe("Bailly, A. (2023). Dictionnaire grec-français (G. Gréco, dir.; nouv. éd. rev. et corr., dite Bailly 2020 – Hugo Chávez, version du 28 février 2023). Association pour la défense des humanités. https://bailly.app (Ouvrage original publié en 1894)");
  });

  it("MLA and ISO 690 with the date of consultation; MLA's container in italics", () => {
    expect(plain(workCitation("mla", { accessed }).text)).toContain("Consulté le 5 octobre 2026.");
    expect(plain(workCitation("mla", { accessed }).html)).toContain("<i>Bailly.app</i>, Association pour la défense des humanités, 28 février 2023, bailly.app.");
    expect(plain(workCitation("iso", { accessed }).text)).toContain("Bordeaux : Association pour la défense des humanités, 2023. Disponible à l'adresse : https://bailly.app [consulté le 5 octobre 2026].");
  });
});

describe("clipboardHtml", () => {
  it("as is, but in a common serif font for WebKit", () => {
    expect(clipboardHtml("A. Bailly, <i>Dictionnaire</i>", false)).toBe("A. Bailly, <i>Dictionnaire</i>");
    expect(clipboardHtml("A. Bailly, <i>Dictionnaire</i>", true))
      .toBe("<span style=\"font-family: 'Times New Roman', serif\">A. Bailly, <i>Dictionnaire</i></span>");
  });
});

describe("biblatexEntry", () => {
  it("an article of a reference work, the persons and the edition as in the other references", () => {
    expect(biblatexEntry(logos, { accessed })).toBe([
      "@inreference{bailly:logos,",
      "  author      = {Bailly, Anatole},",
      "  title       = {λόγος},",
      "  booktitle   = {Dictionnaire grec-français},",
      "  editor      = {Gréco, Gérard},",
      "  editora     = {Charbonnet, André and De Wilde, Mark and Maréchal, Bernard},",
      "  editoratype = {collaborator},",
      "  edition     = {Nouvelle édition revue et corrigée, dite Bailly 2020 -- Hugo Chávez},",
      "  date        = {2023-02-28},",
      "  origdate    = {1894},",
      "  publisher   = {Association pour la défense des humanités},",
      "  location    = {Bordeaux},",
      "  url         = {https://bailly.app/logos},",
      "  urldate     = {2026-10-05},",
      "  langid      = {french},",
      "}",
    ].join("\n"));
  });

  it("a homonym: its number in superscript, its anchor in the address, a key of its own", () => {
    const entry = biblatexEntry(oudos2, { version: "2027-01-15", accessed });
    expect(entry).toContain("@inreference{bailly:oudos-2,");
    expect(entry).toContain("title       = {οὐδός\\textsuperscript{2}},");
    expect(entry).toContain("url         = {https://bailly.app/oudos#2},");
    expect(entry).toContain("date        = {2027-01-15},");
  });

  it("keys without diacritics, LaTeX's special characters escaped", () => {
    expect(bibKey({ word: "ψυχή", uri: "psuchê" })).toBe("bailly:psuche");
    expect(biblatexFileName({ word: "οὐδός", uri: "oudos#2" })).toBe("bailly-oudos-2.bib");
    expect(biblatexEntry({ word: "a_b&c", uri: "ab" }, { accessed })).toContain("title       = {a\\_b\\&c},");
  });

  it("the date of consultation, the reader's day", () => {
    expect(isoDate(new Date(2026, 0, 3, 23, 59))).toBe("2026-01-03");
  });
});

describe("entryMetadata", () => {
  it("a dictionary entry for Zotero, without Highwire's book title (a book section)", () => {
    const meta = Object.fromEntries(entryMetadata({ word: "λόγος", uri: "logos" }).map(({ name, content }) => [name, content]));
    expect(meta["z.itemType"]).toBe("dictionaryEntry");
    expect(meta["citation_title"]).toBe("λόγος");
    expect(meta["prism.publicationName"]).toBe("Dictionnaire grec-français");
    expect(meta["citation_date"]).toBe("2023-02-28");
    expect(entryMetadata({ word: "καθυστερέω", uri: "kathustereô-ô" })).toContainEqual({ name: "citation_public_url", content: "https://bailly.app/kathustereô-ô" });
    expect(meta).not.toHaveProperty("citation_book_title");
    expect(meta).not.toHaveProperty("citation_inbook_title");
  });
});
