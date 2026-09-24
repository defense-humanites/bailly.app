import { KeyType, Preset, toTransliteration } from "greek-conversion";
import { LocalStorageKey, type Color } from "./enums";

/**
 * Returns Tailwind classes.
 * As variants are created dynamically, colors must be registered
 * in the `safelist` (cf. ./tailwind.config.mjs).
 */
export function getColorClasses(
  color?: Color,
  state?: "active" | "focus" | "hover"
): string {
  if (!color) return "";

  const formattedState: string = state ? `${state}:` : "";
  const lightShade: string = "600";
  const darkShade: string = "400";

  let classList: string[] = [];
  for (const className of ["text", "fill"]) {
    const baseClass: string = `${className}-${color.toLowerCase()}`;
    classList.push(`${formattedState}${baseClass}-${lightShade}`);
    classList.push(`dark:${formattedState}${baseClass}-${darkShade}`);
  }

  return classList.join(" ");
}

export function highlightEntryInExcerpt(word: string, excerpt: string): string {
  // Count the characters that are present in the extract but removed from
  // the separated word: 'Asterisk', 'Middle Dot' (\u00B7).
  const countSpecialChars: number = [...excerpt.matchAll(/[*\u00B7]/g)].length;

  return (
    `<strong>${word}</strong>` + excerpt?.slice(word.length + countSpecialChars)
  );
}

export function romanizeGreekStrings(): void {
  const lsKey = localStorage.getItem(LocalStorageKey.EnableGreekRomanization);
  const romanizationRequested = lsKey === "true";

  if (!romanizationRequested) return;

  const greekElements = document.querySelectorAll(".grec, .gens, .es, .des");
  greekElements.forEach((item) => {
    if (item.textContent) {
      // Don't transliterate Greek Ano Teleia ('\u0387'), nor its NFC form, the
      // middle dot ('\u00B7'), used by the database: both would become ";".
      item.textContent = toTransliteration(
        item.textContent.replace(/[\u0387\u00B7]/g, "§"),
        KeyType.GREEK,
        Preset.ALA_LC
      ).replace(/§/g, "\u00B7");
    }
  });
}

export function setEmailAddress(): void {
  const encodedEmail = import.meta.env.PUBLIC_CONTACT_EMAIL_ENCODED;
  const contactElements = document.querySelectorAll("[data-contact]");

  for (const element of contactElements) {
    element.setAttribute("href", "mailto:".concat(atob(encodedEmail)));
  }
}

export function setTheme(): void {
  if (
    localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
