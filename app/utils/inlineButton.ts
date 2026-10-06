/**
 * A button within a text, as a key (e.g. the bookmarks' guide, the news),
 * pointing out the control it names. Its negative margins keep it within the
 * line (a key 24 px high, as the line, set in its middle, overflowed it by
 * 2 px): a line with a key is as high as the others.
 */
export const INLINE_BUTTON = "-my-0.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm bg-default px-1.5 align-middle text-sm font-medium text-default ring ring-inset ring-accented transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)";
