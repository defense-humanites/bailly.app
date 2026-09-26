import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type Preferences,
} from "~/utils/preferences";

/**
 * The user's preferences (cf. `utils/preferences.ts`), shared across the
 * application and stored in a cookie when the user changes them.
 */
export function usePreferences() {
  const { $preferencesCookie: cookie } = useNuxtApp();

  /**
   * The preferences the user has set (the others have their default value).
   */
  const stored = useState<Partial<Preferences>>("preferences", () => parsePreferences(cookie.value));

  /**
   * Sets preferences, and stores them.
   */
  const set = (values: Partial<Preferences>): void => {
    stored.value = { ...stored.value, ...values };
    cookie.value = stored.value;
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
   * Restores the default preferences, and removes the cookie.
   */
  const reset = (): void => {
    stored.value = {};
    cookie.value = null;
  };

  return { preference, set, reset };
}
