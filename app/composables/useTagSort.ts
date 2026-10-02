/**
 * How the tags are sorted on the bookmarks page (cf. `utils/tagSort.ts`): a
 * preference, which can be synchronized (cf. `utils/preferences.ts`).
 */
export const useTagSort = () => usePreferences().preference("tagSort");
