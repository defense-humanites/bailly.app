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
  Teal: "bleu canard",
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
 * Local storage keys that are used accross the application.
 */
export enum LocalStorageKey {
  /**
   * The current (usually the latest inserted) tag key from IndexedDB `bailly.tags` table.
   */
  CurrentTagKey = "currentTagKey",
  /**
   * If it exists, no more bookmarks info should be displayed (cf. 'app/pages/signets.vue').
   */
  DismissBookmarksInfoCard = "dismissBookmarksInfoCard",
  /**
   * If it exists, no more morphological results should should be displayed (cf. 'app/components/Searchbar.vue').
   */
  DismissSearchBarMorphologicalResultsWarning = "dismissSearchBarMorphologicalResultsWarning",
  /**
   * If it exists, greek strings (for instance those that carry the `.grec` CSS class) across the application should be romanized.
   */
  EnableGreekRomanization = "enableGreekRomanization",
  /**
   * The current history length settings.
   */
  HistoryLength = "historyLength",
  /**
   * The current input mode settings.
   */
  SearchInputMode = "searchInputMode",
  /**
   * If this setting exists, search queries should not be lemmatized.
   */
  SearchSkipLemmatization = "searchSkipLemmatization",
  /**
   * The current theme settings.
   */
  Theme = "theme",
}
