export default defineAppConfig({
  ui: {
    // The palette « Grèce classique » (cf. `assets/css/theme.css`).
    colors: {
      primary: "terracotta",
      secondary: "aegean",
      info: "aegean",
      warning: "gold",
      neutral: "marble",
    },
    /*
     * Rounded buttons (pills). The items of a panel (a popover's list and its
     * footer actions) have moderately rounded corners instead, set where they
     * are (`rounded-md`, as the menus' items). Only the solid buttons (main
     * actions) have a relief (`button-relief`, cf. components.css), a
     * semibold text, in a hue of the palette (cf. `compoundVariants`); the
     * outline ones a slight shadow; the others none.
     */
    button: {
      slots: {
        base: "rounded-full",
      },
      variants: {
        variant: {
          // Strings (the class of the base slot), as in Nuxt UI's theme: an
          // object (`{ base: … }`) was merged into its string as
          // « [object Object] », and these classes were lost.
          solid: "button-relief font-semibold",
          outline: "shadow-xs",
        },
        size: {
          // A gap rather than margins around the icons: a label hidden (e.g.
          // `sr-only`) then leaves a square (round) button.
          "2xl": {
            base: "px-3.5 py-2.5 text-base gap-1.5",
            leadingIcon: "size-6",
            leadingAvatarSize: "xs",
            trailingIcon: "size-6",
          },
        },
      },
      // The text in a hue of the palette rather than plain white or black:
      // gold on terracotta (the cream gold, 4.7:1; in the dark theme, a dark
      // gold, 3.4:1, chosen over the darkest one, 5.1:1), the Aegean blue in
      // its lightest shade on the dark blue (7:1) and conversely (5.9:1).
      // Pressed, or while the panel it opens is open (`aria-expanded`: a
      // menu, a dialog; not `data-state`, which a tooltip around the button
      // sets too, to its own state), the button darkens a little rather than
      // turning translucent (as on hover), and keeps that look until it
      // closes.
      // Literal classes, for Tailwind to find them.
      compoundVariants: [
        { color: "primary", variant: "solid", class: "text-(--ui-color-warning-100) dark:text-(--ui-color-warning-900) active:bg-primary active:brightness-95 aria-expanded:bg-primary aria-expanded:brightness-95" },
        { color: "secondary", variant: "solid", class: "text-(--ui-color-secondary-100) dark:text-(--ui-color-secondary-900) active:bg-secondary active:brightness-95 aria-expanded:bg-secondary aria-expanded:brightness-95" },
        { color: "success", variant: "solid", class: "active:bg-success active:brightness-95 aria-expanded:bg-success aria-expanded:brightness-95" },
        { color: "info", variant: "solid", class: "active:bg-info active:brightness-95 aria-expanded:bg-info aria-expanded:brightness-95" },
        { color: "warning", variant: "solid", class: "active:bg-warning active:brightness-95 aria-expanded:bg-warning aria-expanded:brightness-95" },
        { color: "error", variant: "solid", class: "active:bg-error active:brightness-95 aria-expanded:bg-error aria-expanded:brightness-95" },
      ],
    },
    input: {
      slots: {
        base: "rounded-full shadow-lg shadow-black/10",
      },
      variants: {
        size: {
          "2xl": {
            base: "px-3.5 py-2.5 text-base gap-2",
            leading: "ps-3",
            trailing: "pe-3",
            leadingIcon: "size-6",
            leadingAvatarSize: "xs",
            trailingIcon: "size-6",
          },
        },
      },
      compoundVariants: [
        {
          leading: true,
          size: "2xl",
          class: "ps-11",
        },
        {
          trailing: true,
          size: "2xl",
          class: "pe-11",
        },
      ],
    },
    inputMenu: {
      slots: {
        base: "rounded-full",
      },
    },
    card: {
      slots: {
        root: "rounded-lg shadow-xl shadow-black/10",
      },
      variants: {
        variant: {
          solid: {
            root: "bg-default ring ring-default",
          },
          bookmarkGroup: {
            root: "border border-neutral-400/25 bg-neutral-400/15 backdrop-blur-[2px]",
          },
        },
      },
    },
    radioGroup: {
      slots: {
        item: "grow justify-center",
        wrapper: "w-auto",
      },
    },
  },
});
