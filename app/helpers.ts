import { convert } from "@humanities/greek-conversion";

/**
 * Picks a random item from a list.
 * @param items The candidate items.
 * @param exclude Items that must not be picked.
 * @returns A random item from `items` that is not part of `exclude`.
 * @throws If no item remains after the exclusions.
 */
export function pickRandom<T>(items: readonly T[], exclude: readonly T[] = []): T {
  const available = items.filter(item => !exclude.includes(item));
  const picked = available[Math.floor(Math.random() * available.length)];

  if (picked === undefined) {
    throw new Error("No available items to pick from after exclusions.");
  }

  return picked;
}

/**
 * Splits an excerpt around its headword, so that the headword can be
 * emphasized (without injecting HTML).
 * @param word The headword, as a separate field (e.g. `ῥινόκερως`).
 * @param excerpt The excerpt, which starts with the headword, possibly with
 * characters absent from the separated word: asterisk, middle dot (e.g.
 * `ῥινό·κερως, ωτος…`).
 * @returns The headword (as given) and the rest of the excerpt. If the
 * excerpt doesn't start with the headword, it is returned as `rest`.
 */
export function splitExcerpt(word: string, excerpt: string): { word: string; rest: string } {
  // Each character of the word, escaped, possibly followed by special characters.
  const pattern = Array.from(word, character => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[*·]*");
  const match = word ? new RegExp(`^[*·]*${pattern}`, "u").exec(excerpt) : null;

  if (!match) return { word: "", rest: excerpt };

  return { word, rest: excerpt.slice(match[0].length) };
}

/**
 * Transliterates Greek text (ALA-LC), keeping the ano teleia (·).
 * @remarks Meant for the "transliterated Greek" preference (to come).
 */
export function transliterateGreek(text: string): string {
  return convert(text.replace(/\u0387/g, "§"), "greek", "transliteration", { preset: "ala-lc-ancient" })
    .replace(/§/g, "\u0387");
}
