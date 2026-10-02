/**
 * The background of the fields of the bookmarks page's menu bar (cf.
 * `signets.vue`, `CreateTag`): in the light theme, the search bar's (the
 * palette's white, as the bar's buttons); in the dark one, Nuxt UI's `soft`
 * variant's. Their focus outline is drawn inside them
 * (`-outline-offset-3`): the bar clips what goes beyond its corners.
 */
export const FIELD_BACKGROUND = "bg-default hover:bg-elevated/40 focus:bg-default dark:bg-elevated/50 dark:hover:bg-elevated dark:focus:bg-elevated";
