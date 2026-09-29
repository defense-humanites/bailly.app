import { convert } from "@humanities/greek-conversion";
import { GREEK_LETTER, normalizeSearchGreek } from "#shared/utils/searchGreek";
import { InputMode } from "~/enums";

const GREEK_LETTER_RE = new RegExp(`^${GREEK_LETTER}$`, "u");

/**
 * Diacritics sharing a class can't stack on a letter.
 */
type DiacriticClass = "breathingOrDiaeresis" | "accent" | "iotaSubscript";

interface Diacritic {
  class: DiacriticClass;
  /** The combining mark. */
  mark: string;
  /** The spacing form, displayed while the diacritic waits for its letter. */
  spacing?: string;
  /** The (lowercase) letters taking it. */
  letters: string;
}

const VOWELS = "αεηιουω";

/**
 * Keyed by Beta Code sign. The spacing forms are stable under NFC.
 */
const DIACRITICS: Record<string, Diacritic> = {
  ")": { class: "breathingOrDiaeresis", mark: "̓", spacing: "᾿", letters: `${VOWELS}ρ` },
  "(": { class: "breathingOrDiaeresis", mark: "̔", spacing: "῾", letters: `${VOWELS}ρ` },
  "+": { class: "breathingOrDiaeresis", mark: "̈", spacing: "¨", letters: "ιυ" },
  "/": { class: "accent", mark: "́", spacing: "´", letters: VOWELS },
  "\\": { class: "accent", mark: "̀", spacing: "`", letters: VOWELS },
  "=": { class: "accent", mark: "͂", spacing: "῀", letters: "αηιυω" },
  "|": { class: "iotaSubscript", mark: "ͅ", spacing: "ͺ", letters: "αηω" },
  // (`?`, the underdot, is a wildcard: cf. `WILDCARDS`.)
};

/**
 * Diacritics by combining mark or spacing form (including variants), to read
 * back the input text, which is already partly converted.
 */
const DIACRITICS_BY_FORM = new Map<string, Diacritic>(Object.values(DIACRITICS).flatMap(diacritic => [
  [diacritic.mark, diacritic] as const,
  ...(diacritic.spacing ? [[diacritic.spacing, diacritic] as const] : []),
]));
DIACRITICS_BY_FORM.set("´", DIACRITICS["/"]!); // Oxia.
DIACRITICS_BY_FORM.set("΄", DIACRITICS["/"]!); // Tonos.
DIACRITICS_BY_FORM.set("`", DIACRITICS["\\"]!); // Varia.

const CLASS_ORDER: DiacriticClass[] = ["breathingOrDiaeresis", "accent", "iotaSubscript"];

/**
 * The wildcards, within a word: `?` stands for one letter, `*` for any number
 * of letters (after a letter: at the start of a word, `*` is the Beta Code
 * capital mark). The position in the headwords is a search option.
 */
const WILDCARDS = /[?*]/;

/**
 * The spacing forms of the diacritics, as long as they wait for a letter.
 */
const PENDING_DIACRITICS = new RegExp(`[${[...DIACRITICS_BY_FORM.keys()].filter(form => !/\p{M}/u.test(form)).join("")}]`, "gu");

/**
 * A capital mark waiting for its letter: a `*` at the start of a word (after
 * a letter or a wildcard, it's a wildcard).
 */
const PENDING_CAPITAL = /(?<![\p{L}\p{M}?])\*/gu;

/**
 * Beta Code letters (the case doesn't matter).
 */
const BETA_CODE_LETTERS = /[a-z]+/gi;

/**
 * The API's metacharacters for the position of the query in the headwords:
 * this position is now a search option (cf. `toPositionedQuery`).
 */
const POSITION_METACHARACTERS = /[\^$"]/g;

interface Letter {
  base: string;
  diacritics: Diacritic[];
  /** Combining marks that aren't Beta Code diacritics (e.g. a pasted macron). */
  others: string;
}

interface Pending {
  capital: boolean;
  diacritics: Diacritic[];
}

const accepts = (letter: Letter, diacritic: Diacritic): boolean =>
  diacritic.letters.includes(letter.base.toLowerCase())
  && !letter.diacritics.some(({ class: c }) => c === diacritic.class);

const renderLetter = (letter: Letter): string =>
  letter.base
  + CLASS_ORDER.map(c => letter.diacritics.find(d => d.class === c)?.mark ?? "").join("")
  + letter.others;

/**
 * The spacing forms of diacritics that didn't find a letter.
 */
const renderAlone = (diacritics: Diacritic[]): string =>
  diacritics.map(diacritic => diacritic.spacing ?? "").join("");

/**
 * Applies the diacritics and capital marks, as Beta Code signs or already
 * converted (the input is converted again at each keystroke).
 * - After a letter taking it, a diacritic goes on it (`α` + `)` → `ἀ`).
 * - Otherwise, like a dead key, it waits for the next letter as a spacing
 *   form (`᾿`), as after the capital mark (`*` + `)` → `*᾿`); the next letter
 *   takes it (`*᾿` + `α` → `Ἀ`), unless it can't (`᾿` + `σ` → `᾿σ`) or the
 *   next character isn't a letter: the spacing form then stays alone.
 */
function applyDiacritics(text: string): string {
  const output: (string | Letter)[] = [];
  // (Not narrowed to `null`: `flush` resets it.)
  let pending = null as Pending | null;

  const flush = (): void => {
    if (!pending) return;
    output.push((pending.capital ? "*" : "") + renderAlone(pending.diacritics));
    pending = null;
  };

  for (const character of text.normalize("NFD")) {
    const diacritic = DIACRITICS_BY_FORM.get(character) ?? DIACRITICS[character];
    const previous = output.at(-1);
    const letter = typeof previous === "object" ? previous : null;

    if (diacritic) {
      // A combining mark (already converted Greek) always stays on its letter.
      if (letter && !pending && /\p{M}/u.test(character)) {
        if (accepts(letter, diacritic)) letter.diacritics.push(diacritic);
        else letter.others += character;
      } else if (pending) {
        pending.diacritics.push(diacritic);
      } else if (letter && accepts(letter, diacritic)) {
        letter.diacritics.push(diacritic);
      } else if (diacritic.spacing) {
        pending = { capital: false, diacritics: [diacritic] };
      }
    } else if (/\p{M}/u.test(character) && letter && !pending) {
      letter.others += character;
    } else if (character === "*" && !pending && (letter || previous === "*" || previous === "?")) {
      // Within a word, a wildcard (cf. `WILDCARDS`).
      output.push(character);
    } else if (character === "*") {
      flush();
      pending = { capital: true, diacritics: [] };
    } else if (GREEK_LETTER_RE.test(character)) {
      const current: Letter = { base: character, diacritics: [], others: "" };
      if (pending) {
        if (pending.capital) current.base = current.base.toUpperCase();
        const alone = pending.diacritics.filter((d) => {
          if (!accepts(current, d)) return true;
          current.diacritics.push(d);
          return false;
        });
        if (alone.length) output.push(renderAlone(alone));
        pending = null;
      }

      output.push(current);
    } else {
      flush();
      output.push(character);
    }
  }

  flush();

  return output.map(part => (typeof part === "string" ? part : renderLetter(part))).join("").normalize("NFC");
}

/**
 * Converts the search bar input into Greek: Beta Code is converted, with its
 * diacritics (e.g. `logos` → `λογος`, `a)nh/r` → `ἀνήρ`, `*)aqh=nai` →
 * `Ἀθῆναι`, `vergon` → `ϝεργον`), Greek is normalized, the wildcards are
 * kept (`l?gos` → `λ?γος`, `fil*os` → `φιλ*ος`, cf. `WILDCARDS`), and the
 * position metacharacters (`^`, `$`, `"`) are dropped (cf. `toPositionedQuery`).
 * @remarks The input may mix Greek (already converted) and Beta Code (the
 * last characters typed). Diacritics and capital marks without a letter yet
 * wait for it (cf. `applyDiacritics`), and are left out of the query (cf.
 * `toSearchQuery`).
 */
export function toSearchGreek(input: string): string {
  return normalizeSearchGreek(applyDiacritics(
    input.replace(POSITION_METACHARACTERS, "").replace(BETA_CODE_LETTERS, run => convert(run.toLowerCase(), "beta-code", "greek", { removeDiacritics: true })),
  ));
}

/**
 * The query to look up, from the search bar input converted into Greek:
 * without the diacritics and capital marks left without a letter (the API
 * would read such a `*` as a wildcard).
 */
export function toSearchQuery(greek: string): string {
  return greek.replace(PENDING_DIACRITICS, "").replace(PENDING_CAPITAL, "").trim();
}

/**
 * Whether the query has wildcards (cf. `WILDCARDS`).
 */
export function hasWildcards(query: string): boolean {
  return WILDCARDS.test(query);
}

/**
 * Where the query is looked up in the headwords.
 */
export type SearchPosition = "start" | "contains" | "end" | "exact";

/**
 * The query with the API's metacharacters for its position in the headwords:
 * the API looks prefixes up by default, a leading `*` makes it look the query
 * up anywhere, a trailing `$` at the end, and quotes the whole headword.
 * @example toPositionedQuery("λογος", "end") // "λογος$"
 */
export function toPositionedQuery(query: string, position: SearchPosition): string {
  if (!query) return "";

  switch (position) {
    case "contains":
      return `*${query}`;
    case "end":
      return `${query}$`;
    case "exact":
      return `"${query}"`;
    case "start":
    default:
      return query;
  }
}

/**
 * Whether inflected forms can be looked up too (through the morphological
 * analysis): not for a part of a word (`contains`, `end`), which can't be
 * analyzed, nor with wildcards (the API doesn't apply them to the analyses).
 */
export function isLemmatizable(position: SearchPosition, wildcards = false): boolean {
  return (position === "start" || position === "exact") && !wildcards;
}

/**
 * The Greek query to look up, from the search bar input: already converted
 * from Beta Code while typing (cf. `toSearchGreek`), or transliterated, which
 * is converted now (`ph` can't be converted before the `h`).
 * @example toLookupQuery("lógos", InputMode.Transliteration) // "λόγος"
 */
export function toLookupQuery(input: string, inputMode: InputMode): string {
  if (inputMode !== InputMode.Transliteration) return toSearchQuery(input);

  // The segments between wildcards are converted one by one: the conversion
  // would read `?` as a question mark, and `*` as the end of a word.
  const segments = input.replace(POSITION_METACHARACTERS, "").split(/([?*])/);
  const greek = segments.map((segment, index) => {
    if (index % 2) return segment;
    const converted = convert(segment, "transliteration", "greek");
    // Within a word, no breathing (added to the vowel starting a segment).
    const before = segments.slice(0, index).join("").replace(/[?*]/g, "");
    return before && !/\s$/.test(before)
      ? converted.normalize("NFD").replace(/^(\p{L})[\u0313\u0314]/u, "$1").normalize("NFC")
      : converted;
  }).join("");

  return toSearchQuery(normalizeSearchGreek(greek));
}

/**
 * Converts the search bar input when the input mode changes.
 * @example convertSearchInput("λόγος", InputMode.Transliteration) // "lógos"
 */
export function convertSearchInput(input: string, inputMode: InputMode): string {
  return inputMode === InputMode.Transliteration
    ? convert(toSearchQuery(input), "greek", "transliteration")
    : toLookupQuery(input, InputMode.Transliteration);
}
