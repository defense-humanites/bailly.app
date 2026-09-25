import { convert } from "@humanities/greek-conversion";

/**
 * A Greek letter (not a modifier letter such as the spacing ypogegrammeni).
 */
const GREEK_LETTER = String.raw`(?=\p{Script=Greek})[\p{Ll}\p{Lu}\p{Lt}]`;
const GREEK_LETTER_RE = new RegExp(`^${GREEK_LETTER}$`, "u");

/**
 * Diacritics sharing a class can't stack on a letter.
 */
type DiacriticClass = "breathingOrDiaeresis" | "accent" | "iotaSubscript" | "underdot";

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
  // No spacing form: an underdot without a letter to take it is dropped.
  "?": { class: "underdot", mark: "̣", letters: "αβγδεζηθικλμνξοπρστυφχψωϝ" },
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
DIACRITICS_BY_FORM.set("́̓"[0]!, DIACRITICS["/"]!);

const CLASS_ORDER: DiacriticClass[] = ["breathingOrDiaeresis", "accent", "iotaSubscript", "underdot"];

/**
 * The spacing forms and the capital mark, as long as they wait for a letter.
 */
const PENDING_SIGNS = new RegExp(`[*${[...DIACRITICS_BY_FORM.keys()].filter(form => !/\p{M}/u.test(form)).join("")}]`, "gu");

/**
 * Beta Code letters (the case doesn't matter).
 */
const BETA_CODE_LETTERS = /[a-z]+/gi;

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
 * Normalizes Greek for the search: no letter variants, and final sigmas where
 * words end. Diacritics are kept (the API ignores them unless asked not to).
 */
export function normalizeSearchGreek(greek: string): string {
  return greek
    .normalize("NFC")
    .replace(/ϐ/g, "β")
    .replace(/ϲ/g, "σ")
    .replace(new RegExp(`ς(?=${GREEK_LETTER})`, "gu"), "σ")
    .replace(new RegExp(`σ(?!${GREEK_LETTER})`, "gu"), "ς");
}

/**
 * Converts the search bar input into Greek: Beta Code is converted, with its
 * diacritics (e.g. `logos` → `λογος`, `a)nh/r` → `ἀνήρ`, `*)aqh=nai` →
 * `Ἀθῆναι`, `vergon` → `ϝεργον`), Greek is normalized, and the search
 * metacharacters (`^`, `$`, `"`) are kept.
 * @remarks The input may mix Greek (already converted) and Beta Code (the
 * last characters typed). Diacritics and capital marks without a letter yet
 * wait for it (cf. `applyDiacritics`), and are left out of the query (cf.
 * `toSearchQuery`).
 */
export function toSearchGreek(input: string): string {
  return normalizeSearchGreek(applyDiacritics(
    input.replace(BETA_CODE_LETTERS, run => convert(run.toLowerCase(), "beta-code", "greek", { removeDiacritics: true })),
  ));
}

/**
 * The query to look up, from the search bar input converted into Greek:
 * without the diacritics and capital marks left without a letter (the API
 * would read `*` as a wildcard).
 */
export function toSearchQuery(greek: string): string {
  return greek.replace(PENDING_SIGNS, "").trim();
}
