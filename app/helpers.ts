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

export function highlightEntryInExcerpt(
  word: string,
  excerpt: string,
  className: string = "font-semibold",
): string {
  // The excerpt starts with the word, which may contain characters that are
  // absent from the separated word: 'Asterisk', 'Middle Dot' (\u00B7). Find
  // where the word ends in the excerpt, only counting those characters there.
  let end = 0;
  for (let matched = 0; end < excerpt.length && matched < word.length; end++) {
    if (!/[*\u00B7]/.test(excerpt.charAt(end))) matched++;
  }

  return `<span class="${className}">${word}</span>` + excerpt.slice(end);
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
