import { InputMode } from "~/enums";
import { READING_FONTS, type ReadingFont } from "~/utils/fonts";

/**
 * The user's preferences, chosen in the settings (and, for the search ones,
 * in the search options). They are stored in a cookie, so that the server
 * renders the pages with them (no change at hydration).
 * @remarks The cookie is only set when the user changes a preference (it
 * then customizes the interface at the user's request: no consent needed).
 */
export type Preferences = {
  /** Whether Greek is shown in Latin characters (transliterated) across the application. */
  transliterateGreek: boolean;
  /** The serif font, of the entries' text in particular (cf. `utils/fonts.ts`). */
  readingFont: ReadingFont;
  /** The size of the entries' text (cf. `--reading-font-size`). */
  readingSize: ReadingSize;
  /** The weight of the entries' text (cf. `--reading-font-weight`). */
  readingWeight: ReadingWeight;
  /** How Greek is typed in the search bar (Greek itself is always accepted). */
  inputMode: InputMode;
  /** Whether inflected forms are looked up too, when possible. */
  inflectedForms: boolean;
};

export const READING_SIZES = ["small", "normal", "large", "larger"] as const;
export type ReadingSize = typeof READING_SIZES[number];

export const READING_WEIGHTS = ["normal", "bold"] as const;
export type ReadingWeight = typeof READING_WEIGHTS[number];

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  transliterateGreek: false,
  readingFont: "brill",
  readingSize: "normal",
  readingWeight: "normal",
  inputMode: InputMode.BetaCode,
  inflectedForms: true,
};

export const PREFERENCES_COOKIE = "bailly-preferences";

/**
 * About 13 months (the lifetime recommended by the CNIL), renewed on each change.
 */
export const PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 396;

/**
 * The valid preferences of a (decoded) cookie value: unknown keys and
 * invalid values are dropped, the defaults applying instead.
 */
export function parsePreferences(value: unknown): Partial<Preferences> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const preferences: Partial<Preferences> = {};

  if (typeof record.transliterateGreek === "boolean") preferences.transliterateGreek = record.transliterateGreek;
  if (typeof record.readingFont === "string" && Object.hasOwn(READING_FONTS, record.readingFont)) preferences.readingFont = record.readingFont as ReadingFont;
  if (READING_SIZES.includes(record.readingSize as ReadingSize)) preferences.readingSize = record.readingSize as ReadingSize;
  if (READING_WEIGHTS.includes(record.readingWeight as ReadingWeight)) preferences.readingWeight = record.readingWeight as ReadingWeight;
  if (Object.values(InputMode).includes(record.inputMode as InputMode)) preferences.inputMode = record.inputMode as InputMode;
  if (typeof record.inflectedForms === "boolean") preferences.inflectedForms = record.inflectedForms;

  return preferences;
}
