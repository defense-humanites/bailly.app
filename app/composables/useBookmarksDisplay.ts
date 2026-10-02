/**
 * The display of the bookmarks (cf. `utils/bookmarksDisplay.ts`): a
 * preference, which can be synchronized (cf. `utils/preferences.ts`).
 */
export const useBookmarksDisplay = () => usePreferences().preference("bookmarksDisplay");
