/**
 * The senses of a definition (cf. `components.css`): up to three levels, a
 * part (`Rub`, « A. »), a section (`rub`, « I. ») and a sense (`pp`, « 1. »),
 * each opened by its number (`Ruba`, `ruba`, `ppa`); the sections opened by
 * a label (`sect`, `secta`): the middle and passive voices (« Moy. »,
 * « Pass. »), which hold senses of their own, the comparatives (« Cp. »);
 * and the notes opened by an arrow (`fleche`, `flechea`) when they hold
 * senses (the other forms of ὁ, numbered), cf. `isSense`.
 */
export const SENSE_SELECTOR = ".Rub, .rub, .pp, .sect, .fleche";

/** A sense's number (or label, or arrow), its first child. */
const NUMBER_SELECTOR = ":scope > :is(.Ruba, .ruba, .ppa, .secta, .flechea)";

/** Whether an element of `SENSE_SELECTOR` is a sense: an arrow's note only if it holds senses. */
const isSense = (element: Element): boolean => !element.matches(".fleche") || element.querySelector(".Rub, .rub, .pp") !== null;

/** The senses of the definitions within an element (or of it), in their order. */
export const sensesIn = (root: Element): Element[] => [...root.querySelectorAll(SENSE_SELECTOR)].filter(isSense);

/** A sense's number, with its period (« I » → « I. », « Moy. » as is); none for an arrow. */
const numberOf = (sense: Element): string => {
  const number = sense.querySelector(NUMBER_SELECTOR);
  if (!number || number.matches(".flechea")) return "";
  const text = number.textContent.trim();
  return text.endsWith(".") ? text : `${text}.`;
};

/** Whether a sense opens with an arrow (rather than a number). */
const arrowOf = (sense: Element): boolean => sense.querySelector(NUMBER_SELECTOR)?.matches(".flechea") ?? false;

/**
 * A step of the path to a sense: its number (with its period), or an arrow,
 * and its label (cf. `senseLabel`).
 */
export type SenseStep = {
  number: string;
  arrow?: boolean;
  label: string;
};

/**
 * What ends a sense's head: a reference, a sub-sense, a section.
 */
const HEAD_END = `.aut, .oeuv, .oeuva, .refch, .refpa, .refpb, .sect, .fleche, ${SENSE_SELECTOR}`;

/** The strong punctuation, which ends a clause of a sense's head (not the commas, between its glosses). */
const CLAUSE_END = /[;:(|]/g;

const LETTER = /\p{L}/u;

/**
 * The kind of a character of a sense's head: a remark (`.ital`), Greek
 * (`.grec`), or text (the French, and the headword alone in Greek).
 */
type Kind = "remark" | "greek" | "text";

/**
 * Whether a Greek span is the headword alone (« καί se contracte… »): read
 * as the text around it, not as an expression closing the head.
 */
const isHeadwordAlone = (element: Element): boolean =>
  element.children.length > 0
  && [...element.children].every(child => child.matches("[data-linked-self]"))
  && [...element.childNodes].every(node => node.nodeType !== Node.TEXT_NODE || !LETTER.test(node.textContent ?? ""));

/**
 * A sense's label: the head of its text, right after its number, remarks
 * included, up to its first strong punctuation (« B *adv.* aussi, même : »
 * → « adv. aussi, même »), before any reference; none if the sense opens on
 * one. Never a line further in its body.
 *
 * - A Greek expression closes it, with an « etc. » after it: the words the
 *   sense is about (« 7 καὶ μέν, et en outre… » → « καὶ μέν », « 3 *dans les
 *   locut.* εἴ τις καὶ ἄλλος, *etc. ;* » → « dans les locut. εἴ τις καὶ
 *   ἄλλος, etc. »); but the headword alone.
 * - A first clause that is only a remark, a linking word (*p. suite*, *en
 *   b. part*), is followed by the next one when it holds a gloss in French
 *   (« *en b. part :* bonne opinion »); not by a further remark (« *avec des
 *   mots invariables : adverbes :* » → « avec des mots invariables »), nor
 *   by a citation (« *pour unir deux propos. :* ὁ ἵππος… »).
 * - The remarks ending it, after a comma, are left out (« s’attacher à,
 *   *d’où* », « retenir, *c. à d.* »).
 */
export function senseLabel(sense: Element): string {
  const number = sense.querySelector(NUMBER_SELECTOR);
  // The head's text, the kind of each of its characters, and the end of its
  // first Greek expression (with an « etc. » after it).
  let text = "";
  const kinds: Kind[] = [];
  const push = (part: string, kind: Kind): void => {
    text += part;
    kinds.push(...Array.from({ length: part.length }, () => kind));
  };
  let greekEnd = Number.POSITIVE_INFINITY;
  for (let node = number?.nextSibling ?? null; node && text.length < greekEnd; node = node.nextSibling) {
    if (node instanceof Element && node.matches(HEAD_END)) break;
    const part = node.textContent ?? "";
    if (!(node instanceof Element)) {
      push(part, "text");
    } else if (node.matches(".ital")) {
      push(part, "remark");
    } else if (node.matches(".grec") && !isHeadwordAlone(node) && LETTER.test(part)) {
      push(part, "greek");
      greekEnd = text.length;
      let next = node.nextSibling;
      while (next?.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) next = next.nextSibling;
      if (next instanceof Element && next.matches(".ital") && next.textContent.trim().startsWith("etc.")) {
        push(" etc.", "remark");
        greekEnd = text.length;
      }
    } else {
      push(part, "text");
    }
  }

  const holds = (from: number, to: number, accepted: Kind[]): boolean => {
    for (let index = from; index < to; index++) {
      if (accepted.includes(kinds[index]!) && LETTER.test(text[index]!)) return true;
    }
    return false;
  };
  const outsideGreek = (pattern: RegExp, to: number): number[] =>
    [...text.slice(0, to).matchAll(pattern)].map(match => match.index).filter(index => kinds[index] !== "greek");

  // Its first clause (up to a strong punctuation outside the Greek), or the
  // first two past a linking word.
  const ends = [...outsideGreek(CLAUSE_END, greekEnd), Math.min(text.length, greekEnd)];
  const [first, second] = ends;
  let end = first!;
  if (second !== undefined && !holds(0, first!, ["text", "greek"]) && holds(first! + 1, second, ["text"])) end = second;

  // Without the remarks ending it, after a comma.
  const commas = outsideGreek(/,/g, end);
  while (commas.length && !holds(commas.at(-1)! + 1, end, ["text", "greek"])) end = commas.pop()!;

  // The line breaks of the source as spaces, its no-break spaces kept.
  const label = text.slice(0, end).replace(/[ \t\r\n]+/g, " ").replace(/[\s,]+$/, "").trim();
  return LETTER.test(label) ? label : "";
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
    number: numberOf(current),
    ...(arrowOf(current) ? { arrow: true } : {}),
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

/**
 * An item of an entry's outline (cf. `entryOutline`): a sense (its number
 * and label), or, for a group of homonyms, one of them (its headword).
 */
export type OutlineItem = {
  /** The sense's element, or the homonym's definition. */
  element: Element;
  number: string;
  label: string;
  /** Its level (0 at the top). */
  depth: number;
  /** Whether it opens with an arrow (rather than a number). */
  arrow?: boolean;
  /** The index of the item it belongs to, or -1. */
  parent: number;
  /** Whether it is a sense (not a homonym). */
  sense: boolean;
  /** A homonym's number (cf. `numberHeadword`), after its headword. */
  homonym?: string;
};

/**
 * The outline of an entry: its senses, in their order, with their numbers
 * and labels (cf. `senseLabel`); for a group of homonyms, each homonym (its
 * headword and number), with or without senses, its senses under it (their
 * numbers start again).
 * @param root The element holding the entry's definitions (`.definition`),
 *   or one of them.
 */
export function entryOutline(root: Element): OutlineItem[] {
  const definitions = [...(root.matches(".definition") ? [root] : []), ...root.querySelectorAll(".definition")];
  const homonyms = definitions.length > 1;
  const items: OutlineItem[] = [];
  for (const [index, definition] of definitions.entries()) {
    let top = -1;
    if (homonyms) {
      top = items.length;
      // Its headword, without its number (cf. `numberHeadword`).
      const head = definition.querySelector(".entreea")?.cloneNode(true) as Element | undefined;
      for (const number of head?.querySelectorAll(".homonym") ?? []) number.remove();
      const headword = head?.textContent.replace(/[\s,]+$/, "").trim() ?? "";
      const homonym = definition.querySelector(".entreea .homonym")?.textContent ?? String(index + 1);
      items.push({ element: definition, number: "", label: headword, depth: 0, parent: -1, sense: false, homonym });
    }
    const indexes = new Map<Element, number>();
    for (const sense of sensesIn(definition)) {
      const outer = sense.parentElement?.closest(SENSE_SELECTOR);
      const parent = outer && definition.contains(outer) ? indexes.get(outer) ?? top : top;
      indexes.set(sense, items.length);
      items.push({
        element: sense,
        number: numberOf(sense),
        ...(arrowOf(sense) ? { arrow: true } : {}),
        label: senseLabel(sense),
        depth: parent < 0 ? 0 : items[parent]!.depth + 1,
        parent,
        sense: true,
      });
    }
  }
  return items;
}

/**
 * Whether an entry needs an outline: at least two items (senses, sections
 * or homonyms), one of them starting out of the first screen (`beyondFold`,
 * the page at its top): the outline leads to what can't be seen; none if
 * every number is in view at once, however many (9 October 2026).
 * @param items The entry's outline (cf. `entryOutline`).
 * @param beyondFold Whether an item's element starts out of the first screen.
 */
export function outlineWorthy(items: OutlineItem[], beyondFold: (element: Element) => boolean): boolean {
  return items.length >= 2 && items.some(item => beyondFold(item.element));
}
