import { InputMode } from "~/enums";
import { BOOKMARKS_DISPLAYS, type BookmarksDisplay } from "~/utils/bookmarksDisplay";
import { READING_FONTS, type ReadingFont } from "~/utils/fonts";
import { isTagSort, type TagSort } from "~/utils/tagSort";

/**
 * The user's preferences, chosen in the settings (and, for the search ones,
 * in the search options). They are stored in a cookie, so that the server
 * renders the pages with them (no change at hydration).
 * @remarks The cookie is only set when the user changes a preference (it
 * then customizes the interface at the user's request: no consent needed).
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = typeof THEMES[number];

export const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

export type Preferences = {
  /** The color mode (applied by the color mode module, cf. `useThemePreference`). */
  theme: Theme;
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
  /** How the bookmarks page shows the entries (cf. `utils/bookmarksDisplay.ts`). */
  bookmarksDisplay: BookmarksDisplay;
  /** How the bookmarks page sorts the tags not pinned (cf. `utils/tagSort.ts`). */
  tagSort: TagSort;
};

export const READING_SIZES = ["small", "normal", "large", "larger"] as const;
export type ReadingSize = typeof READING_SIZES[number];

export const READING_WEIGHTS = ["normal", "bold"] as const;
export type ReadingWeight = typeof READING_WEIGHTS[number];

export const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  theme: "system",
  transliterateGreek: false,
  readingFont: "book",
  readingSize: "normal",
  readingWeight: "normal",
  inputMode: InputMode.BetaCode,
  inflectedForms: true,
  bookmarksDisplay: "excerpts",
  tagSort: "recent",
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

  if (isTheme(record.theme)) preferences.theme = record.theme;
  if (typeof record.transliterateGreek === "boolean") preferences.transliterateGreek = record.transliterateGreek;
  if (typeof record.readingFont === "string" && Object.hasOwn(READING_FONTS, record.readingFont)) preferences.readingFont = record.readingFont as ReadingFont;
  if (READING_SIZES.includes(record.readingSize as ReadingSize)) preferences.readingSize = record.readingSize as ReadingSize;
  if (READING_WEIGHTS.includes(record.readingWeight as ReadingWeight)) preferences.readingWeight = record.readingWeight as ReadingWeight;
  if (Object.values(InputMode).includes(record.inputMode as InputMode)) preferences.inputMode = record.inputMode as InputMode;
  if (typeof record.inflectedForms === "boolean") preferences.inflectedForms = record.inflectedForms;
  if (BOOKMARKS_DISPLAYS.includes(record.bookmarksDisplay as BookmarksDisplay)) preferences.bookmarksDisplay = record.bookmarksDisplay as BookmarksDisplay;
  if (isTagSort(record.tagSort)) preferences.tagSort = record.tagSort;

  return preferences;
}

/**
 * The preferences that can be synchronized across devices, if the user
 * chooses so (cf. `preferenceRecords.ts`), in the order of the preferences
 * page, then those of the bookmarks page (the display of the entries, the
 * sorting of the tags).
 */
export const SYNCABLE_PREFERENCES = [
  "theme",
  "transliterateGreek",
  "readingFont",
  "readingSize",
  "readingWeight",
  "inflectedForms",
  "inputMode",
  "bookmarksDisplay",
  "tagSort",
] as const;
export type SyncablePreference = typeof SYNCABLE_PREFERENCES[number];

/**
 * The preferences offered checked when the synchronization of the preferences
 * is enabled: the others are rather the device's, the size and the weight of
 * the text depending on its screen, the input mode on its keyboard (the
 * transliteration suits a computer's better than a touch screen), the
 * display of the bookmarks on its screen too. The theme and the sorting of
 * the tags, habits rather than matters of screen, are offered checked.
 */
export const DEFAULT_SYNCED_PREFERENCES: readonly SyncablePreference[] = ["theme", "transliterateGreek", "inflectedForms", "readingFont", "tagSort"];

export const isSyncablePreference = (key: string): key is SyncablePreference =>
  (SYNCABLE_PREFERENCES as readonly string[]).includes(key);
