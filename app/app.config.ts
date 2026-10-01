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
     * semibold text and a text in their own hue (its lightest shade, its
     * darkest in the dark theme) rather than plain white or black; the
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
      // The text in the button's hue; pressed, the button darkens (rather
      // than turning translucent, as on hover), with its relief sunk.
      // Literal classes, for Tailwind to find them.
      compoundVariants: [
        { color: "primary", variant: "solid", class: "text-(--ui-color-primary-50) dark:text-(--ui-color-primary-950) active:bg-primary active:brightness-90" },
        { color: "secondary", variant: "solid", class: "text-(--ui-color-secondary-50) dark:text-(--ui-color-secondary-950) active:bg-secondary active:brightness-90" },
        { color: "success", variant: "solid", class: "text-(--ui-color-success-50) dark:text-(--ui-color-success-950) active:bg-success active:brightness-90" },
        { color: "info", variant: "solid", class: "text-(--ui-color-info-50) dark:text-(--ui-color-info-950) active:bg-info active:brightness-90" },
        { color: "warning", variant: "solid", class: "text-(--ui-color-warning-50) dark:text-(--ui-color-warning-950) active:bg-warning active:brightness-90" },
        { color: "error", variant: "solid", class: "text-(--ui-color-error-50) dark:text-(--ui-color-error-950) active:bg-error active:brightness-90" },
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
