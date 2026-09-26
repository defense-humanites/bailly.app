import { InputMode, LegacyStorageKey } from "~/enums";
import type { Preferences } from "~/utils/preferences";

export type LegacyStorageMigration = {
  /** The preferences the user had set (none: nothing to store). */
  preferences: Partial<Preferences>;
  /** The theme the user had chosen (`light` or `dark`; none: the system's). */
  theme?: "light" | "dark";
  /** The key of the current tag. */
  currentTag?: number;
  /** The notices the user had dismissed. */
  dismissed: string[];
};

/**
 * Reads the local storage of the previous (Astro) application, then removes
 * its keys (the obsolete ones too).
 * @param storage The local storage.
 * @returns What to store in the new places, or `null` if there was nothing
 * to migrate.
 */
export function takeLegacyStorage(storage: Storage): LegacyStorageMigration | null {
  const keys = Object.values(LegacyStorageKey).filter(key => storage.getItem(key) !== null);
  if (!keys.length) return null;

  const read = (key: LegacyStorageKey): string | null => storage.getItem(key);
  const migration: LegacyStorageMigration = { preferences: {}, dismissed: [] };

  // The Astro app stored the radio buttons' values (`"true"`/`"false"`…).
  if (read(LegacyStorageKey.SearchInputMode) === InputMode.Transliteration) {
    migration.preferences.inputMode = InputMode.Transliteration;
  }
  if (read(LegacyStorageKey.SearchSkipLemmatization) === "true") {
    migration.preferences.inflectedForms = false;
  }
  if (read(LegacyStorageKey.EnableGreekRomanization) === "true") {
    migration.preferences.transliterateGreek = true;
  }

  const theme = read(LegacyStorageKey.Theme);
  if (theme === "light" || theme === "dark") migration.theme = theme;

  const currentTag = Number(read(LegacyStorageKey.CurrentTagKey) || Number.NaN);
  if (Number.isInteger(currentTag)) migration.currentTag = currentTag;

  if (read(LegacyStorageKey.DismissSearchBarMorphologicalResultsWarning) === "true") {
    migration.dismissed.push("morpheusWarning");
  }

  for (const key of keys) storage.removeItem(key);

  return migration;
}
