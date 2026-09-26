import {
  PREFERENCES_COOKIE,
  PREFERENCES_COOKIE_MAX_AGE,
  type Preferences,
} from "~/utils/preferences";

/**
 * Provides the preferences cookie (cf. `usePreferences`), read by the server
 * as well: the pages are rendered with the user's preferences.
 */
export default defineNuxtPlugin(() => {
  const cookie = useCookie<Partial<Preferences> | null | undefined>(PREFERENCES_COOKIE, {
    maxAge: PREFERENCES_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    // Not in development: Safari rejects secure cookies over `http://localhost`.
    secure: !import.meta.dev,
  });

  return {
    provide: {
      preferencesCookie: cookie,
    },
  };
});
