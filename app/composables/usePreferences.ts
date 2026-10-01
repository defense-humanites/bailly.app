import { IdbPreferences } from "~/idb";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  PREFERENCES_COOKIE,
  SYNCABLE_PREFERENCES,
  type Preferences,
} from "~/utils/preferences";

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
    if (!import.meta.client) return;
    IdbPreferences.record(values).then((records) => {
      if (records.length) useSyncStore().preferencesChanged(records.map(({ key }) => key));
    }).catch((e: unknown) => {
      console.error("The change of the preferences could not be recorded", e);
    });
  };

  /**
   * Sets preferences, and stores them.
   * @param options.stamp Whether the change is the user's, stamped for the
   * synchronization (not a migration, nor a change received from another
   * device, which carries its own stamp).
   */
  const set = (values: Partial<Preferences>, { stamp = true }: { stamp?: boolean } = {}): void => {
    stored.value = { ...stored.value, ...values };
    cookie.value = stored.value;
    if (stamp) record(values);
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
    refreshCookie(PREFERENCES_COOKIE);
    stored.value = parsePreferences(cookie.value);
  };

  return { preference, set, reset, reload };
}
