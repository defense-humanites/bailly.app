/**
 * The bubbles that inform rather than offer choices (a field's error or
 * hint, the home page's note on the edition): set apart from the panels
 * and menus, raised (`--app-panel-bg`), and, in the light theme, from the
 * tooltips, a shade darker with a clear border (`--app-bubble-bg`,
 * `--app-bubble-ring`, cf. `root.css`); in the dark theme, the tooltips'
 * look. A shadow under them.
 */
export const BUBBLE = "bg-(--app-bubble-bg) ring ring-(--app-bubble-ring) shadow-md";

/** Their arrow, when they have one: the bubble's color and border. */
export const BUBBLE_ARROW = "fill-(--app-bubble-bg) stroke-(--app-bubble-ring)";
