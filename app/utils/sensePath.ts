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
 * A sense's label: its first gloss, the bare text (the French) after its
 * number, the remarks, citations and references before it skipped (« I.
 * *propr.* porter : » → « porter »); cut at its first punctuation. Without a
 * gloss before its first sub-sense, its first remark (« *p. suite* »).
 */
export function senseLabel(sense: Element): string {
  const number = sense.querySelector(":scope > :is(.Ruba, .ruba, .ppa)");
  let text = "";
  let remark = "";
  for (let node = number?.nextSibling ?? null; node; node = node.nextSibling) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      continue;
    }
    if (!(node instanceof Element) || node.matches(SENSE_SELECTOR)) break;
    // An element after the gloss's start ends it.
    if (/\p{L}/u.test(text)) break;
    if (!remark && node.matches(".ital")) remark = node.textContent;
  }
  return firstClause(text) || firstClause(remark);
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
