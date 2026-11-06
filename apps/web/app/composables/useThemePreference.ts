import { isTheme } from "~/utils/preferences";

/**
 * The theme, a preference (synchronizable, cf. `SYNCABLE_PREFERENCES`) that
 * the color mode module applies (and keeps in its own cookie, for the server
 * and its inline script): both kept in step. A choice of the user (the color
 * mode changed) is recorded as a preference (stamped); a theme received
 * from another device (the preference changed) is applied.
 * @remarks To be called once, on the client (cf. `app.vue`).
 */
export function useThemePreference(): void {
  const colorMode = useColorMode();
  const { preference, isSet, set } = usePreferences();
  const theme = preference("theme");

  // On opening: the preference, if set; otherwise, the color mode's, not
  // stamped (it gives way to any synchronized change).
  if (isSet("theme")) {
    if (colorMode.preference !== theme.value) colorMode.preference = theme.value;
  } else if (isTheme(colorMode.preference) && colorMode.preference !== theme.value) {
    set({ theme: colorMode.preference }, { stamp: false });
  }

  watch(() => colorMode.preference, (value) => {
    if (isTheme(value) && value !== theme.value) theme.value = value;
  });
  watch(theme, (value) => {
    if (value !== colorMode.preference) colorMode.preference = value;
  });
}
