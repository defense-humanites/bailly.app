/**
 * The senses of a definition (cf. `components.css`): up to three levels, a
 * part (`Rub`, « A. »), a section (`rub`, « I. ») and a sense (`pp`, « 1. »),
 * each opened by its number (`Ruba`, `ruba`, `ppa`).
 */
export const SENSE_SELECTOR = ".Rub, .rub, .pp";

/** A step of the path to a sense: its number (with its period) and its first gloss. */
export type SenseStep = {
  number: string;
  label: string;
};

/**
 * Cuts a text at its first punctuation (the end of a gloss), its spaces
 * normalized.
 */
const firstClause = (text: string): string =>
  text.replace(/\s+/g, " ").replace(/^[\s,;:.]+/, "").split(/[,;:(|]/)[0]!.trim();

/**
 * What ends a sense's head: a citation, a reference, a sub-sense.
 */
const HEAD_END = `.grec, .aut, .oeuv, .oeuva, .refch, .refpa, .refpb, .sect, .fleche, ${SENSE_SELECTOR}`;

/**
 * A sense's label: the head of its text, right after its number, remarks
 * included (« 6 *avec des mots invariables : adverbes :* » → « avec des
 * mots invariables », « I. *propr.* porter : » → « propr. porter »), cut at
 * its first punctuation, before any citation or reference; none if the
 * sense opens on one. Never a line further in its body.
 */
export function senseLabel(sense: Element): string {
  const number = sense.querySelector(":scope > :is(.Ruba, .ruba, .ppa)");
  let text = "";
  for (let node = number?.nextSibling ?? null; node; node = node.nextSibling) {
    if (node instanceof Element && node.matches(HEAD_END)) break;
    text += node.textContent ?? "";
    if (/[,;:(|]/.test(text)) break;
  }
  return /\p{L}/u.test(text) ? firstClause(text) : "";
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
