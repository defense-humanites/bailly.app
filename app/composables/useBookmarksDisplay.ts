import { StorageKey } from "~/enums";

/**
 * How the entries of the bookmarks page's cards are shown: their excerpts
 * (cards, the default), or their headwords alone (on two columns, many more
 * at a glance).
 */
export type BookmarksDisplay = "excerpts" | "headwords";

export const BOOKMARKS_DISPLAY_LABELS: Record<BookmarksDisplay, string> = {
  excerpts: "Extraits",
  headwords: "Vedettes seules",
};

/**
 * The display of the bookmarks, kept on the device (local storage; nothing
 * is written until it is chosen). Read once the application is hydrated:
 * the cards, loaded from IndexedDB, are not rendered by the server.
 */
export const useBookmarksDisplay = () => useLocalStorage<BookmarksDisplay>(StorageKey.BookmarksDisplay, "excerpts", {
  writeDefaults: false,
  initOnMounted: true,
  serializer: {
    read: (value: string) => (value === "headwords" ? "headwords" : "excerpts"),
    write: (value: BookmarksDisplay) => value,
  },
});
