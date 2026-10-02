/**
 * A set of colors that can be used for tags and so on.
 * @remarks `Color.Yellow` should be reserved for starred entries.
 */
export enum Color {
  Blue = "blue",
  Green = "green",
  Lime = "lime",
  Orange = "orange",
  Purple = "violet",
  Red = "rose",
  Rose = "pink",
  Sky = "sky",
  Slate = "slate",
  Teal = "teal",
  Yellow = "yellow",
}

export type ColorKey = keyof typeof Color;

/**
 * The colors' French names (e.g. for accessible names).
 */
export const colorNames: Record<ColorKey, string> = {
  Blue: "bleu",
  Green: "vert",
  Lime: "vert citron",
  Orange: "orange",
  Purple: "violet",
  Red: "rouge",
  Rose: "rose",
  Sky: "bleu ciel",
  Slate: "gris ardoise",
  Teal: "turquoise",
  Yellow: "jaune",
};

/**
 * Input modes that can be used to type greek in the search bar.
 */
export enum InputMode {
  BetaCode = "betaCode",
  Transliteration = "transliteration",
}

/**
 * The keys of the interface's state in the local storage (the preferences
 * are in a cookie, cf. `utils/preferences.ts`; the bookmarks and the history
 * in IndexedDB).
 */
export enum StorageKey {
  /**
   * The key of the current tag (IndexedDB `tags` table).
   */
  CurrentTag = "bailly:currentTag",
  /**
   * The notices the user dismissed (a list of ids, e.g. `morpheusWarning`).
   */
  Dismissed = "bailly:dismissed",
  /**
   * How the tags are sorted on the bookmarks page (cf. `utils/tagSort.ts`).
   */
  TagSort = "bailly:tagSort",
  /**
   * The theme (`system`, `light` or `dark`), managed by the color mode
   * module (cf. `colorMode.storageKey` in `nuxt.config.ts`).
   */
  Theme = "bailly:theme",
}

/**
 * The local storage keys of the previous (Astro) application, migrated once
 * (cf. `utils/legacyStorage.ts`), then removed.
 */
export enum LegacyStorageKey {
  CurrentTagKey = "currentTagKey",
  DismissBookmarksInfoCard = "dismissBookmarksInfoCard",
  DismissBookmarksSyncInfobox = "dismissBookmarksSyncInfobox",
  DismissSearchBarMorphologicalResultsWarning = "dismissSearchBarMorphologicalResultsWarning",
  EnableGreekRomanization = "enableGreekRomanization",
  HistoryLength = "historyLength",
  SearchInputMode = "searchInputMode",
  SearchResultsDisplay = "searchResultsDisplay",
  SearchSkipLemmatization = "searchSkipLemmatization",
  Theme = "theme",
}
