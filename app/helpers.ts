import { convert } from "@humanities/greek-conversion";
import { LocalStorageKey } from "~/enums";

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
 * @param excerpt The excerpt, which starts with the headword, possibly after
 * a homonym number and with characters absent from the separated word:
 * asterisk, middle dot (e.g. `ῥινό·κερως, ωτος…`).
 * @returns The text before the headword, the headword (as given) and the rest
 * of the excerpt. If the headword isn't found, the excerpt is returned as `rest`.
 */
export function splitExcerpt(
  word: string,
  excerpt: string,
): { before: string; word: string; rest: string } {
  // Each character of the word, escaped, possibly followed by special characters.
  const pattern = Array.from(word, character => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[*·]*");
  const match = word ? new RegExp(`^(\\P{L}*?)[*·]*${pattern}`, "u").exec(excerpt) : null;

  if (!match) return { before: "", word: "", rest: excerpt };

  return { before: match[1] ?? "", word, rest: excerpt.slice(match[0].length) };
}

export function romanizeGreekStrings(): void {
  const lsKey = localStorage.getItem(LocalStorageKey.EnableGreekRomanization);
  const romanizationRequested = lsKey === "true";

  if (!romanizationRequested) return;

  const greekElements = document.querySelectorAll(".grec, .gens, .es, .des");
  greekElements.forEach((item) => {
    if (item.textContent) {
      // Don't transliterate Greek Ano Teleia ('\u0387').
      item.textContent = convert(
        item.textContent.replace(/\u0387/g, "§"),
        "greek", "transliteration",
        { preset: "ala-lc-ancient" },
      ).replace(/§/g, "\u0387");
    }
  });
}
