/**
 * The background of the fields of the bookmarks page's menu bar (cf.
 * `signets.vue`, `CreateTag`): in the light theme, the search bar's (the
 * palette's white, as the bar's buttons); in the dark one, Nuxt UI's `soft`
 * variant's.
 */
export const FIELD_BACKGROUND = "bg-default hover:bg-elevated/40 focus:bg-default dark:bg-elevated/50 dark:hover:bg-elevated dark:focus:bg-elevated";

/**
 * Their focus halo (an outline) and ring, as the search bar's, but neutral
 * (the accent stays the search bar's): outside the item that holds the
 * field (whatever part of it has the keyboard focus), over its neighbours
 * (`z-10`): below `lg`, a ring just outside its edge (an inset one would
 * be painted under the field's background), the halo around it; from `lg`,
 * its border takes the ring's color. The field's own outline is
 * transparent. The bar no
 * longer clips its items (no `overflow-hidden`): below `lg`, they round
 * their own corners (`--field-inner-radius`, the bar's radius less its
 * border, cf. `signets.vue`).
 */
export const FIELD_HALO = "relative outline-inverted/25 has-[:focus-visible]:z-10 has-[:focus-visible]:outline-3 max-lg:has-[:focus-visible]:outline-offset-1 max-lg:has-[:focus-visible]:ring max-lg:has-[:focus-visible]:ring-inverted lg:has-[:focus-visible]:border-inverted";
