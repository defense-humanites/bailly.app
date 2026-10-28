/** The shape of a button within a text (cf. `INLINE_BUTTON`), its colors apart. */
const INLINE_BUTTON_SHAPE = "-my-0.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm px-1.5 align-middle text-sm ring ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)";

/**
 * A button within a text, as a key (e.g. the bookmarks' guide, the news),
 * pointing out the control it names. Its negative margins keep it within the
 * line (a key 24 px high, as the line, set in its middle, overflowed it by
 * 2 px): a line with a key is as high as the others. A shade darker when
 * hovered, two when pressed, as every button (cf. `root.css`).
 */
export const INLINE_BUTTON = `${INLINE_BUTTON_SHAPE} font-medium bg-default text-default ring-accented hover:bg-(--app-card-hover) active:bg-(--app-card-active)`;

/**
 * The same in gold, within a text in gold (the home page's tips): tinted,
 * a shade darker when hovered, two when pressed; its text as the tip's (its
 * weight too: in medium, it looked larger), a notch darker (800, 200 in the
 * dark theme).
 */
export const INLINE_BUTTON_GOLD = `${INLINE_BUTTON_SHAPE} bg-warning/10 text-(--ui-color-warning-800) ring-warning/35 hover:bg-warning/20 active:bg-warning/30 dark:text-(--ui-color-warning-200)`;
