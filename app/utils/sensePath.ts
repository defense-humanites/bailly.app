/**
 * The senses of a definition (cf. `components.css`): up to three levels, a
 * part (`Rub`, « A. »), a section (`rub`, « I. ») and a sense (`pp`, « 1. »),
 * each opened by its number (`Ruba`, `ruba`, `ppa`).
 */
export const SENSE_SELECTOR = ".Rub, .rub, .pp";

/** A step of the path to a sense: its number (with its period) and its label (cf. `senseLabel`). */
export type SenseStep = {
  number: string;
  label: string;
};

/**
 * What ends a sense's head: a citation, a reference, a sub-sense.
 */
const HEAD_END = `.grec, .aut, .oeuv, .oeuva, .refch, .refpa, .refpb, .sect, .fleche, ${SENSE_SELECTOR}`;

/** What ends a clause of a sense's head. */
const CLAUSE_END = /[,;:(|]/g;

const LETTER = /\p{L}/u;

/**
 * A sense's label: the head of its text, right after its number, remarks
 * included (« 6 *avec des mots invariables : adverbes :* » → « avec des
 * mots invariables », « I. *propr.* porter : » → « propr. porter »), cut at
 * its first punctuation, before any citation or reference; none if the
 * sense opens on one. Never a line further in its body.
 *
 * A first clause that is only a remark, a linking word (*p. suite*,
 * *par ext.*), is followed by the next one when it holds a gloss (« 2
 * *p. suite,* avoir à sa disposition, » → « p. suite, avoir à sa
 * disposition »); not by a further remark (« adverbes »).
 */
export function senseLabel(sense: Element): string {
  const number = sense.querySelector(":scope > :is(.Ruba, .ruba, .ppa)");
  // The head's text, and for each of its characters whether it belongs to a
  // remark.
  let text = "";
  const remark: boolean[] = [];
  for (let node = number?.nextSibling ?? null; node; node = node.nextSibling) {
    if (node instanceof Element && node.matches(HEAD_END)) break;
    const part = node.textContent ?? "";
    const isRemark = node instanceof Element && node.matches(".ital");
    text += part;
    remark.push(...Array.from({ length: part.length }, () => isRemark));
  }

  // Its clauses, as [start, end) ranges, the punctuation ending each.
  const clauses: [number, number][] = [];
  let start = 0;
  for (const match of text.matchAll(CLAUSE_END)) {
    clauses.push([start, match.index]);
    start = match.index + 1;
  }
  clauses.push([start, text.length]);

  const has = ([from, to]: [number, number], gloss: boolean): boolean => {
    for (let index = from; index < to; index++) {
      if (LETTER.test(text[index]!) && (!gloss || !remark[index])) return true;
    }
    return false;
  };
  const clean = (from: number, to: number): string => text.slice(from, to).replace(/\s+/g, " ").trim();

  const [first, second] = clauses;
  if (!first || !has(first, false)) return "";
  if (!has(first, true) && second && has(second, true)) return clean(first[0], second[1]);
  return clean(first[0], first[1]);
}

/**
 * The path to a sense, from its outermost part: the parts' and sections'
 * numbers, and the sense's label (cf. `senseLabel`).
 */
export function sensePath(sense: Element | null): SenseStep[] {
  const senses: Element[] = [];
  for (let current = sense; current; current = current.parentElement?.closest(SENSE_SELECTOR) ?? null) {
    senses.unshift(current);
  }
  return senses.map((current, index) => ({
    number: `${current.querySelector(":scope > :is(.Ruba, .ruba, .ppa)")?.textContent.trim() ?? ""}.`,
    label: index === senses.length - 1 ? senseLabel(current) : "",
  }));
}

/**
 * The sense being read: the last one (in the document's order) whose top
 * has passed a line (e.g. the compact bar's bottom edge); none above the
 * first one (the definition's head).
 * @param line A distance from the viewport's top, in pixels.
 */
export function senseAt(senses: Iterable<Element>, line: number): Element | null {
  let current: Element | null = null;
  for (const sense of senses) {
    if (sense.getBoundingClientRect().top > line) break;
    current = sense;
  }
  return current;
}
