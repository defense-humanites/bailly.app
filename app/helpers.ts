import { convert } from "@humanities/greek-conversion";
import { LocalStorageKey } from "~/enums";

/**
 * Return a random key from a given enum.
 * @param enumeration A given enum.
 * @param filter Keys that should not be selected.
 * @returns An enum key if found, otherwise `undefined`.
 */
/* export function pickRandomEnumKey<
  T extends Record<string, string>,
  K extends (keyof T)[],
  F extends K
>(enumeration: T, filter: F): Exclude<K[number], F[number]> {
  const keys = (Object.keys(enumeration) as K).filter(
    (key) => Number.isNaN(Number(key)) && !filter?.includes(key)
  );
  return keys[Math.floor(Math.random() * keys.length)] as Exclude<
    K[number],
    F[number]
  >;
} */

type EnumLike = Record<string | number, string | number>;
type ExcludeKeys<T, K extends keyof T> = Omit<T, K>;

export function pickRandomEnumKey<
  T extends EnumLike,
  E extends keyof T = never,
>(enumObject: T, excludeKeys: E[] = [] as E[]): keyof ExcludeKeys<T, E> {
  const allKeys = Object.keys(enumObject) as (keyof T)[];
  const availableKeys = allKeys.filter(
    key => !excludeKeys.includes(key as E),
  );

  if (!availableKeys.length) {
    throw new Error("No available keys to pick from after exclusions");
  }

  const randomIndex = Math.floor(Math.random() * availableKeys.length);
  return availableKeys[randomIndex] as keyof ExcludeKeys<T, E>;
}

export function highlightEntryInExcerpt(
  word: string,
  excerpt: string,
  className: string = "font-semibold",
): string {
  // Count the characters that are present in the extract but removed from
  // the separated word: 'Asterisk', 'Middle Dot' (\u00B7).
  const countSpecialChars: number = [...excerpt.matchAll(/[*\u00B7]/g)].length;

  return (
    `<span class="${className}">${word}</span>`
    + excerpt?.slice(word.length + countSpecialChars)
  );
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
