/**
 * The bubbles that inform rather than offer choices (a field's error or
 * hint, the home page's note on the edition), as the tooltips (cf.
 * `app.config.ts`): set apart from the panels and menus, raised
 * (`--app-panel-bg`); in the light theme a shade darker than the cards
 * with a clear border, in the dark one the bar's color with a faint one
 * (`--app-bubble-bg`, `--app-bubble-ring`, cf. `root.css`). A shadow under
 * them.
 */
export const BUBBLE = "bg-(--app-bubble-bg) ring ring-(--app-bubble-ring) shadow-md";

/** Their arrow, when they have one: the bubble's color and border. */
export const BUBBLE_ARROW = "fill-(--app-bubble-bg) stroke-(--app-bubble-ring)";
