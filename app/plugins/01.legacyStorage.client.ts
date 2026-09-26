import { StorageKey } from "~/enums";
import { takeLegacyStorage } from "~/utils/legacyStorage";

/**
 * Migrates, once, the local storage of the previous (Astro) application:
 * the preferences go to their cookie (cf. `usePreferences`), the theme to
 * the color mode module, the interface's state to the new keys (cf.
 * `StorageKey`); the former keys are removed.
 * @remarks The interface's state is migrated before the stores read it; the
 * preferences once the app is hydrated (the server rendered the defaults):
 * the page changes then, on this first visit only.
 */
export default defineNuxtPlugin(() => {
  let migration: ReturnType<typeof takeLegacyStorage>;
  try {
    migration = takeLegacyStorage(localStorage);
    if (!migration) return;

    if (migration.currentTag !== undefined) {
      localStorage.setItem(StorageKey.CurrentTag, String(migration.currentTag));
    }
    if (migration.dismissed.length) {
      localStorage.setItem(StorageKey.Dismissed, JSON.stringify(migration.dismissed));
    }
  } catch {
    // Storage unavailable (e.g. blocked): nothing to migrate.
    return;
  }

  const { preferences, theme } = migration;
  const { set } = usePreferences();
  const colorMode = useColorMode();

  onNuxtReady(() => {
    if (Object.keys(preferences).length) set(preferences);
    if (theme) colorMode.preference = theme;
  });
});
