import { IdbPreferences } from "~/idb";
import {
  DEFAULT_PREFERENCES,
  isSyncablePreference,
  parsePreferences,
  PREFERENCES_COOKIE,
  SYNCABLE_PREFERENCES,
  type Preferences,
} from "~/utils/preferences";

/**
 * The preferences of the cookie as it is now in the browser (e.g. changed by
 * another tab, which this tab's state does not follow).
 */
function readCookie(): Partial<Preferences> | null {
  if (!import.meta.client) return null;
  const entry = document.cookie.split("; ").find(part => part.startsWith(`${PREFERENCES_COOKIE}=`));
  if (!entry) return {};
  try {
    return parsePreferences(JSON.parse(decodeURIComponent(entry.slice(PREFERENCES_COOKIE.length + 1))));
  } catch {
    return {};
  }
}

/**
 * The user's preferences (cf. `utils/preferences.ts`), shared across the
 * application and stored in a cookie when the user changes them; the changes
 * of the synchronizable ones are also stamped in IndexedDB (cf.
 * `IdbPreferences`).
 */
export function usePreferences() {
  const { $preferencesCookie: cookie } = useNuxtApp();

  /**
   * The preferences the user has set (the others have their default value).
   */
  const stored = useState<Partial<Preferences>>("preferences", () => parsePreferences(cookie.value));

  /**
   * Stamps the changes of the synchronizable preferences (on the client),
   * then lets the synchronization send them.
   */
  const record = (values: Partial<Preferences>): void => {
    if (!import.meta.client || !Object.keys(values).some(isSyncablePreference)) return;
    IdbPreferences.record(values).then((records) => {
      if (records.length) useSyncStore().preferencesChanged(records.map(({ key }) => key));
    }).catch((e: unknown) => {
      console.error("The change of the preferences could not be recorded", e);
    });
  };

  /**
   * Sets preferences, and stores them (on top of the cookie as it is now, so
   * that the changes of another tab are kept).
   * @param options.stamp Whether the change is the user's, stamped for the
   * synchronization if it changes a value (not a migration, nor a change
   * received from another device, which carries its own stamp).
   */
  const set = (values: Partial<Preferences>, { stamp = true }: { stamp?: boolean } = {}): void => {
    // The cookie's ref follows the other tabs (Nuxt), and each assignment at
    // once (the browser's cookie only once written, later).
    const current = parsePreferences(cookie.value);
    const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) =>
      value !== (current[key as keyof Preferences] ?? DEFAULT_PREFERENCES[key as keyof Preferences])));
    stored.value = { ...current, ...values };
    cookie.value = stored.value;
    if (stamp) record(changed);
  };

  /**
   * A preference, as a writable ref.
   */
  const preference = <K extends keyof Preferences>(key: K): WritableComputedRef<Preferences[K]> =>
    computed({
      get: () => stored.value[key] ?? DEFAULT_PREFERENCES[key],
      set: (value: Preferences[K]) => {
        set({ [key]: value });
      },
    });

  /**
   * Whether the user has set a preference (even to its default value).
   */
  const isSet = (key: keyof Preferences): boolean => stored.value[key] !== undefined;

  /**
   * Restores the default preferences, and removes the cookie; the reset of
   * the synchronizable ones is stamped, so that it reaches the devices that
   * synchronize them.
   */
  const reset = (): void => {
    stored.value = {};
    cookie.value = null;
    record(Object.fromEntries(SYNCABLE_PREFERENCES.map(key => [key, DEFAULT_PREFERENCES[key]])));
  };

  /**
   * Reads the cookie again (e.g. changed by another tab).
   */
  const reload = (): void => {
    stored.value = readCookie() ?? parsePreferences(cookie.value);
  };

  return { preference, set, isSet, reset, reload };
}
