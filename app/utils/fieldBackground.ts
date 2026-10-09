/**
 * The background of the fields of the bookmarks page's menu bar (cf.
 * `signets.vue`, `CreateTag`): the cards', as the bar's buttons, darker
 * when hovered (as them), lighter when focused (raised, as the search bar
 * in use; in the dark theme, lighter in both cases; cf. `--app-field-bg`,
 * `--app-field-hover` and `--app-field-focus`, `root.css`); disabled too (the
 * active tag's field, before the bookmarks are loaded or without tags),
 * rather than Nuxt UI's `soft` variant's, lighter in the dark theme.
 */
export const FIELD_BACKGROUND = "bg-(--app-field-bg) hover:bg-(--app-field-hover) focus:bg-(--app-field-focus) disabled:bg-(--app-field-bg)";

/**
 * Their focus halo (an outline) and ring, as the search bar's, in other
 * colors: the halo in the secondary accent, the ring neutral (cf.
 * `--app-field-ring` and `--app-field-halo`, `root.css`): outside the item that holds the
 * field (whatever part of it has the keyboard focus), over its neighbours
 * (`z-10`): below `lg`, a ring just outside its edge (an inset one would
 * be painted under the field's background), the halo around it; from `lg`,
 * its border takes the ring's color (cf. `--app-field-ring` and
 * `--app-field-halo`, `root.css`). The field's own outline is
 * transparent. The bar no
 * longer clips its items (no `overflow-hidden`): below `lg`, they round
 * their own corners (`--field-inner-radius`, the bar's radius less its
 * border, cf. `signets.vue`).
 */
export const FIELD_HALO = "relative outline-(--app-field-halo) has-[:focus-visible]:z-10 has-[:focus-visible]:outline-3 max-lg:has-[:focus-visible]:outline-offset-1 max-lg:has-[:focus-visible]:ring max-lg:has-[:focus-visible]:ring-(--app-field-ring) lg:has-[:focus-visible]:border-(--app-field-ring)";
