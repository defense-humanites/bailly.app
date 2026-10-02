/**
 * Whether a bar sticks right under the header (e.g. the bookmarks' table of
 * contents) and draws the border under both: the header then hides its own,
 * so that they read as one block.
 */
export const useHeaderExtended = () => useState("header-extended", () => false);
