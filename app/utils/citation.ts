/**
 * The references to cite the dictionary (cf. the entry's « Citer » block):
 * an entry in the text or in a note, in three forms; the work in a
 * bibliography, in four styles. As consulted on Bailly.app: the version
 * actually read (the data's), its address, the date of consultation (the
 * reader's). After the nomenclature established with Antoine (5 October
 * 2026): Bailly as the author; no ISBN (the PDF edition's), no pages (a
 * dictionary is cited by lemma, s. v.).
 *
 * Each reference is built as segments, some in italics, rendered as plain
 * text and as HTML (both put on the clipboard, cf. `copyCitation`).
 */

/** The data's version, as the API gives it (`version`) and the credits say. */
export const DATA_VERSION = "2023-02-28";

/** The canonical address of the application (on any host, e.g. the preview). */
export const CITATION_ORIGIN = "https://bailly.app";

/** The forms of an entry's reference: a full note, a short note, author-date. */
export const ENTRY_CITATION_FORMS = ["note", "short", "authorDate"] as const;
export type EntryCitationForm = typeof ENTRY_CITATION_FORMS[number];

export const ENTRY_CITATION_FORM_LABELS: Record<EntryCitationForm, string> = {
  // In a select, as the bibliography's styles (cf. `EntryCitation`).
  note: "Note complète",
  short: "Note abrégée",
  authorDate: "Auteur-date",
};

/** The styles of the work's reference, in a bibliography. */
export const CITATION_STYLES = ["apa", "mla", "iso", "chicago"] as const;
export type CitationStyle = typeof CITATION_STYLES[number];

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA",
  mla: "MLA",
  iso: "ISO 690",
  chicago: "Chicago",
};

/**
 * A form's label, as the bibliography's style makes it: MLA has no
 * author-date system (its citation in the text gives the author and the
 * entry, without a date).
 */
export const entryCitationFormLabel = (form: EntryCitationForm, style: CitationStyle): string =>
  form === "authorDate" && style === "mla" ? "Dans le texte" : ENTRY_CITATION_FORM_LABELS[form];

export const isEntryCitationForm = (value: unknown): value is EntryCitationForm =>
  ENTRY_CITATION_FORMS.includes(value as EntryCitationForm);
export const isCitationStyle = (value: unknown): value is CitationStyle =>
  CITATION_STYLES.includes(value as CitationStyle);

/** A reference, as plain text and as HTML (the italics as `<i>`). */
export type Citation = { text: string; html: string };

type Segment = string | { italic: string };

const NBSP = " ";

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const render = (segments: Segment[]): Citation => ({
  text: segments.map(segment => (typeof segment === "string" ? segment : segment.italic)).join(""),
  html: segments.map(segment => (typeof segment === "string" ? escapeHtml(segment) : `<i>${escapeHtml(segment.italic)}</i>`)).join(""),
});

/**
 * A reference's HTML as put on the clipboard: as is (the pasted text takes
 * the document's font), but for WebKit (Safari, and every browser on iOS),
 * which rewrites it with its computed styles, the roman text then in a font
 * the other applications don't know (« -webkit-standard »): there, in a
 * common serif font, all the reference alike.
 * @param webkit Whether the browser is WebKit's (cf. `navigator.vendor`).
 */
export function clipboardHtml(html: string, webkit: boolean): string {
  return webkit ? `<span style="font-family: 'Times New Roman', serif">${html}</span>` : html;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * A date in French, « 1er » for the first day of a month.
 * @example frenchDate(2026, 10, 5) // "5 octobre 2026"
 */
function frenchDate(year: number, month: number, day: number): string {
  return `${day === 1 ? "1er" : day}${NBSP}${MONTHS[month - 1]} ${year}`;
}

/** The data's version (`YYYY-MM-DD`), in French (no time zone involved). */
export function versionDate(version: string = DATA_VERSION): string {
  const [year, month, day] = version.split("-").map(Number) as [number, number, number];
  return frenchDate(year, month, day);
}

/** The date of consultation, the reader's day (their time zone). */
export function accessDate(date: Date): string {
  return frenchDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** The year of the version cited (the work's date in author-date references). */
const versionYear = (version: string): string => version.slice(0, 4);

/**
 * The entry cited: its headword, as in the dictionary (in Greek, whatever
 * the transliteration preference), a homonym followed by its number in
 * superscript, as Bailly.app shows it (« οὐδός² »), rather than preceded by
 * it as in M. Gréco's edition: Unicode's superscript digits, kept in the
 * plain text as in the formatted one.
 */
export type CitedEntry = { word: string; uri: string };

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export function citedLemma({ word, uri }: CitedEntry): string {
  const homonym = /#(\d+)$/.exec(uri)?.[1];
  return homonym ? `${word}${homonym.replace(/\d/g, digit => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit)}` : word;
}

/** The entry's address on Bailly.app (a homonym's with its anchor). */
export const entryUrl = ({ uri }: CitedEntry): string => `${CITATION_ORIGIN}/${uri}`;

type Context = { version?: string; accessed: Date };

/**
 * The year of the dictionary's first edition: Hachette, 1895 (its preface
 * is dated November 1894; « parut en 1895 », H. Omont, Comptes rendus de
 * l'Académie des inscriptions et belles-lettres, 1911, p. 829).
 */
const ORIGINAL_YEAR = "1895";

/**
 * An entry's reference, in the text or in a note.
 * @param style The bibliography's style, which the author-date form follows
 * (cf. `verification-formats-citation.md`): APA, both years of a work
 * republished, after a comma; Chicago, the original's in brackets, without a
 * comma; ISO 690, a colon, in the French way; MLA, the author and the entry
 * only (no author-date system). The entry in quotation marks, as in the
 * notes.
 */
export function entryCitation(form: EntryCitationForm, entry: CitedEntry, style: CitationStyle, { version = DATA_VERSION, accessed }: Context): Citation {
  const lemma = citedLemma(entry);
  const sv = `s.${NBSP}v.`;
  switch (form) {
    case "note":
      return render([
        "A. Bailly, ",
        { italic: "Dictionnaire grec-français" },
        `, éd. G.${NBSP}Gréco, Bailly 2020 – Hugo Chávez, version du ${versionDate(version)}, ${sv} «${NBSP}${lemma}${NBSP}», `,
        `${entryUrl(entry)} (consulté le ${accessDate(accessed)}).`,
      ]);
    case "short":
      return render([`Bailly 2020, ${sv} «${NBSP}${lemma}${NBSP}».`]);
    case "authorDate": {
      const quoted = `«${NBSP}${lemma}${NBSP}»`;
      const year = versionYear(version);
      switch (style) {
        case "apa":
          return render([`(Bailly, ${ORIGINAL_YEAR}/${year}, ${sv} ${quoted})`]);
        case "chicago":
          return render([`(Bailly [${ORIGINAL_YEAR}] ${year}, s.v. ${quoted})`]);
        case "iso":
          return render([`(Bailly, ${year}${NBSP}: ${sv} ${quoted})`]);
        case "mla":
          return render([`(Bailly, ${quoted})`]);
      }
    }
  }
}

/** The work's reference, in a bibliography (as consulted on Bailly.app). */
export function workCitation(style: CitationStyle, { version = DATA_VERSION, accessed }: Context): Citation {
  const date = versionDate(version);
  const editionName = "nouvelle édition revue et corrigée, dite Bailly 2020 – Hugo Chávez";
  const edition = `${editionName}, version du ${date}`;
  switch (style) {
    case "apa":
      return render([
        `Bailly, A. (${versionYear(version)}). `,
        { italic: "Dictionnaire grec-français" },
        // The director as French adaptations write it (« dir. »); the
        // publisher before the address; the original's date as APA's
        // « Original work published » (cf. `verification-formats-citation.md`).
        ` (G. Gréco, dir.; nouv. éd. rev. et corr., dite Bailly 2020 – Hugo Chávez, version du ${date}). Association pour la défense des humanités. ${CITATION_ORIGIN} (Ouvrage original publié en ${ORIGINAL_YEAR})`,
      ]);
    case "mla":
      return render([
        "Bailly, Anatole. ",
        { italic: "Dictionnaire grec-français" },
        `. ${ORIGINAL_YEAR}. Sous la direction de Gérard Gréco, avec le concours d'André Charbonnet et al., ${editionName}. `,
        { italic: "Bailly.app" },
        // The site as a second container: its title, its publisher (the
        // association, not the persons: as in the other styles), its date
        // (the version's), its address.
        `, Association pour la défense des humanités, ${date}, bailly.app. Consulté le ${accessDate(accessed)}.`,
      ]);
    case "iso":
      return render([
        "BAILLY, Anatole. ",
        { italic: "Dictionnaire grec-français" },
        ` [en ligne]. Sous la direction de Gérard GRÉCO, avec le concours d'André CHARBONNET, Mark DE WILDE et Bernard MARÉCHAL. ${edition.charAt(0).toUpperCase()}${edition.slice(1)}. `,
        // The publisher of the version consulted, the application's (the
        // association, in Bordeaux), and its year.
        `Bordeaux${NBSP}: Association pour la défense des humanités, ${versionYear(version)}. Disponible à l'adresse${NBSP}: ${CITATION_ORIGIN} [consulté le ${accessDate(accessed)}].`,
      ]);
    case "chicago":
      return render([
        "Bailly, Anatole. ",
        { italic: "Dictionnaire grec-français" },
        `. Sous la direction de Gérard Gréco, avec le concours d'André Charbonnet, Mark De Wilde et Bernard Maréchal. ${edition.charAt(0).toUpperCase()}${edition.slice(1)}. Bailly.app. ${CITATION_ORIGIN}.`,
      ]);
  }
}

/** A date as `YYYY-MM-DD`, the reader's day (their time zone). */
export function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The entry's key in a BibLaTeX file: « bailly: » and its address on
 * Bailly.app in ASCII (accented keys are not reliable with pdfLaTeX), as
 * unique: its long vowels followed by a colon instead of their circumflex,
 * the length mark (IPA's « ː ») in ASCII, a colon never being in an address
 * (`logikôs` → `logiko:s`, apart from the adjective `logikos`); a homonym's
 * number after a hyphen (`bailly:oudos-2`); the parentheses kept (`phi(n)`,
 * apart from `phin`; `hoi_(3)`), any other character dropped; the case kept
 * (`Polis` and `polis`: distinct for biber). The same for every reader: a text can cite the entry
 * (`\cite{bailly:logos}`) before its record is added to the file. Checked
 * unique over the dictionary by `scripts/check-bib-keys.py`.
 */
export function bibKey({ uri }: CitedEntry): string {
  const ascii = uri
    .replace(/[êÊôÔ]/g, char => `${char.normalize("NFD")[0]}:`)
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace("#", "-")
    .replace(/[^\w:()-]/g, "");
  return `bailly:${ascii}`;
}

/** A text as a BibLaTeX field's value: LaTeX's special characters escaped. */
const latex = (text: string): string => text.replace(/[\\{}#$%&_^~]/g, (char) => {
  if (char === "\\") return "\\textbackslash{}";
  if (char === "^" || char === "~") return `\\${char}{}`;
  return `\\${char}`;
});

/** The persons of the edition (as in `workCitation`), as BibLaTeX names. */
const EDITOR = "Gréco, Gérard";
const COLLABORATORS = ["Charbonnet, André", "De Wilde, Mark", "Maréchal, Bernard"];

/** The fields of the dictionary itself, in both records (cf. `biblatexEntry`). */
const workFields = (version: string): [string, string][] => [
  ["editor", EDITOR],
  ["editora", COLLABORATORS.join(" and ")],
  ["editoratype", "collaborator"],
  ["edition", "Nouvelle édition revue et corrigée, dite Bailly 2020 -- Hugo Chávez"],
  ["date", version],
  ["origdate", ORIGINAL_YEAR],
  ["publisher", "Association pour la défense des humanités"],
  ["location", "Bordeaux"],
];

/** A BibLaTeX record: its fields one per line, their names aligned. */
function biblatexRecord(type: string, key: string, fields: [string, string][]): string {
  const width = Math.max(...fields.map(([name]) => name.length));
  return [
    `@${type}{${key},`,
    ...fields.map(([name, value]) => `  ${name.padEnd(width)} = {${value}},`),
    "}",
  ].join("\n");
}

/**
 * The entry as a BibLaTeX record, for LaTeX (biblatex and biber: the Greek
 * headword in UTF-8, which BibTeX would not read) and the reference managers
 * that import it (Zotero, JabRef…). An article of a reference work
 * (`@inreference`, the dictionary cited by entry, as APA wants); the persons
 * and the edition as in the other references (cf. `workCitation`), the
 * collaborators as such (`editora`, « avec la collaboration de » in
 * French); the date, the version's, the original's apart (`origdate`); the
 * entry's address and the day of consultation.
 */
export function biblatexEntry(entry: CitedEntry, { version = DATA_VERSION, accessed }: Context): string {
  const homonym = /#(\d+)$/.exec(entry.uri)?.[1];
  return biblatexRecord("inreference", bibKey(entry), [
    ["author", "Bailly, Anatole"],
    ["title", `${latex(entry.word)}${homonym ? `\\textsuperscript{${homonym}}` : ""}`],
    ["booktitle", "Dictionnaire grec-français"],
    ...workFields(version),
    ["url", entryUrl(entry)],
    ["urldate", isoDate(accessed)],
    ["langid", "french"],
  ]);
}

/** The dictionary's key in a BibLaTeX file (cf. `biblatexWork`). */
export const WORK_BIB_KEY = "bailly";

/**
 * The dictionary as a BibLaTeX record: cited once, its entries in the
 * citations' postnote, as the classics do (`\cite[s.~v. λόγος]{bailly}`);
 * the same fields as an entry's (cf. `biblatexEntry`), the application's
 * address. A `@book` (not `@reference`, which Zotero's import discards).
 */
export function biblatexWork({ version = DATA_VERSION, accessed }: Context): string {
  return biblatexRecord("book", WORK_BIB_KEY, [
    ["author", "Bailly, Anatole"],
    ["title", "Dictionnaire grec-français"],
    ...workFields(version),
    ["url", CITATION_ORIGIN],
    ["urldate", isoDate(accessed)],
    ["langid", "french"],
  ]);
}

/**
 * The name of a BibLaTeX file, after its record's key, without its colons
 * (forbidden in Windows's file names): `bailly-logikos.bib`, `bailly.bib`.
 */
export const biblatexFileName = (key: string): string => `${key.replace(":", "-").replaceAll(":", "")}.bib`;

/** A page's metadata for the reference managers (cf. `entryMetadata`). */
type Metadata = { name: string; content: string }[];

/** The dictionary's edition, in both pages' metadata. */
const editionMetadata = (version: string): Metadata => [
  { name: "citation_author", content: "Bailly, Anatole" },
  { name: "citation_editor", content: EDITOR },
  { name: "prism.edition", content: "Nouvelle édition revue et corrigée, dite Bailly 2020 – Hugo Chávez" },
  { name: "citation_date", content: version },
  { name: "citation_publisher", content: "Association pour la défense des humanités" },
  { name: "eprints.place_of_pub", content: "Bordeaux" },
  { name: "citation_language", content: "fr" },
];

/**
 * The metadata of an entry's page for the reference managers: Zotero's
 * connector saves the page as a dictionary entry (`dictionaryEntry`), with
 * its dictionary, persons, edition, date and publisher (translator
 * « Embedded Metadata »: the item type and the dictionary's title in its
 * RDF namespaces, `z` and PRISM, the rest as Highwire's `citation_*` tags;
 * not `citation_book_title`, which would make it a book section). The
 * address as the references give it, readable (`citation_public_url`); the
 * day of consultation, the connector's. Without the collaborators:
 * Highwire's persons, which replace the others, are authors and editors only.
 */
export function entryMetadata(entry: CitedEntry, version: string = DATA_VERSION): Metadata {
  return [
    { name: "z.itemType", content: "dictionaryEntry" },
    { name: "DC.title", content: entry.word },
    { name: "citation_title", content: entry.word },
    { name: "prism.publicationName", content: "Dictionnaire grec-français" },
    ...editionMetadata(version),
    { name: "citation_public_url", content: entryUrl(entry) },
  ];
}

/**
 * The metadata of the pages but the entries': the dictionary itself, as a
 * book (as `biblatexWork`), which Zotero's connector saves with the same
 * fields as an entry's (cf. `entryMetadata`, the same tags).
 */
export function workMetadata(version: string = DATA_VERSION): Metadata {
  return [
    { name: "z.itemType", content: "book" },
    { name: "DC.title", content: "Dictionnaire grec-français" },
    { name: "citation_title", content: "Dictionnaire grec-français" },
    ...editionMetadata(version),
    { name: "citation_public_url", content: CITATION_ORIGIN },
  ];
}
