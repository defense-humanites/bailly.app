/**
 * The background of the fields of the bookmarks page's menu bar (cf.
 * `signets.vue`, `CreateTag`): in the light theme, the search bar's (the
 * palette's white, as the bar's buttons); in the dark one, Nuxt UI's `soft`
 * variant's.
 */
export const FIELD_BACKGROUND = "bg-default hover:bg-elevated/40 focus:bg-default dark:bg-elevated/50 dark:hover:bg-elevated dark:focus:bg-elevated";

/**
 * Their focus halo (an outline), as the search bar's: outside the item that
 * holds the field (whatever part of it has the keyboard focus), over its
 * neighbours (`z-10`); the field's own outline is transparent. The bar no
 * longer clips its items (no `overflow-hidden`): below `lg`, they round
 * their own corners (`--field-inner-radius`, the bar's radius less its
 * border, cf. `signets.vue`).
 */
export const FIELD_HALO = "relative outline-primary/25 has-[:focus-visible]:z-10 has-[:focus-visible]:outline-3";
