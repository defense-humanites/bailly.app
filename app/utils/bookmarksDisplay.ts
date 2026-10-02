/**
 * How the entries of the bookmarks page's cards are shown: their excerpts
 * (cards, the default), or their headwords alone (on two columns, many more
 * at a glance).
 */
export const BOOKMARKS_DISPLAYS = ["excerpts", "headwords"] as const;
export type BookmarksDisplay = typeof BOOKMARKS_DISPLAYS[number];

export const BOOKMARKS_DISPLAY_LABELS: Record<BookmarksDisplay, string> = {
  excerpts: "Extraits",
  headwords: "Vedettes seules",
};
