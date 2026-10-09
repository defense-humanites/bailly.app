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
      // gold on terracotta (the cream gold, 4.7:1; in the dark theme, the
      // darkest gold, 5.1:1), the Aegean blue in its lightest shade on the
      // blue (in the light theme, a shade lighter than the accent, 600: 5.3:1)
      // and conversely (5.9:1). Hovered, pressed, or while
      // the panel it opens is open (`aria-expanded`: a menu, a dialog; not
      // `data-state`, which a tooltip around the button sets too, to its own
      // state), the button takes the next shade, further from its text (the
      // darker in the light theme, the lighter in the dark one: the contrast
      // grows), rather than Nuxt UI's translucency, which veiled it; pressed
      // or open, it also loses its light (cf. `button-relief`).
      // Literal classes, for Tailwind to find them.
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class: "text-(--ui-color-warning-100) dark:text-(--ui-color-warning-950) hover:bg-(--ui-color-primary-700) active:bg-(--ui-color-primary-700) aria-expanded:bg-(--ui-color-primary-700) dark:hover:bg-(--ui-color-primary-300) dark:active:bg-(--ui-color-primary-300) dark:aria-expanded:bg-(--ui-color-primary-300)",
        },
        {
          color: "secondary",
          variant: "solid",
          class: "text-(--ui-color-secondary-100) dark:text-(--ui-color-secondary-900) bg-(--ui-color-secondary-600) disabled:bg-(--ui-color-secondary-600) aria-disabled:bg-(--ui-color-secondary-600) dark:bg-secondary dark:disabled:bg-secondary dark:aria-disabled:bg-secondary hover:bg-(--ui-color-secondary-700) active:bg-(--ui-color-secondary-700) aria-expanded:bg-(--ui-color-secondary-700) dark:hover:bg-(--ui-color-secondary-200) dark:active:bg-(--ui-color-secondary-200) dark:aria-expanded:bg-(--ui-color-secondary-200)",
        },
        { color: "success", variant: "solid", class: "hover:bg-success active:bg-success aria-expanded:bg-success hover:brightness-90 active:brightness-90 aria-expanded:brightness-90" },
        { color: "info", variant: "solid", class: "hover:bg-info active:bg-info aria-expanded:bg-info hover:brightness-90 active:brightness-90 aria-expanded:brightness-90" },
        { color: "warning", variant: "solid", class: "hover:bg-warning active:bg-warning aria-expanded:bg-warning hover:brightness-90 active:brightness-90 aria-expanded:brightness-90" },
        { color: "error", variant: "solid", class: "hover:bg-error active:bg-error aria-expanded:bg-error hover:brightness-90 active:brightness-90 aria-expanded:brightness-90" },
        // The neutral ghost and outline buttons, hovered and pressed, as the
        // other items on the cards (`--app-card-hover`, `--app-card-active`,
        // cf. `root.css`): Nuxt UI's `bg-elevated` barely showed on them in
        // the light theme.
        { color: "neutral", variant: "ghost", class: "hover:bg-(--app-card-hover) active:bg-(--app-card-active)" },
        { color: "neutral", variant: "outline", class: "hover:bg-(--app-card-hover) active:bg-(--app-card-active)" },
      ],
    },
    /*
     * The menus' and lists' highlighted item (and the one whose submenu is
     * open), as the items on the cards (`--app-menu-highlight`, cf.
     * `root.css`): Nuxt UI's `bg-elevated/50` barely showed in the light
     * theme.
     */
    dropdownMenu: {
      variants: {
        active: {
          false: {
            item: "data-highlighted:before:bg-(--app-menu-highlight) data-[state=open]:before:bg-(--app-menu-highlight)",
          },
        },
      },
    },
    select: {
      slots: {
        item: "data-highlighted:not-data-disabled:before:bg-(--app-menu-highlight)",
      },
    },
    selectMenu: {
      slots: {
        item: "data-highlighted:not-data-disabled:before:bg-(--app-menu-highlight)",
      },
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
    /*
     * The windows: narrower side margins on mobile (8px, as the header's),
     * rather than aligned with the contents under them (16px).
     */
    modal: {
      variants: {
        fullscreen: {
          false: {
            content: "w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)]",
          },
        },
        scrollable: {
          true: {
            overlay: "p-2 sm:p-4",
          },
        },
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
            root: "border border-neutral-400/25 bg-neutral-400/15",
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
    /*
     * Off, a switch a shade darker in the light theme (neutral 300 rather
     * than `bg-accented`, 200): more visible on the light cards.
     */
    switch: {
      slots: {
        base: "data-[state=unchecked]:bg-(--ui-color-neutral-300) dark:data-[state=unchecked]:bg-accented",
      },
    },
    /*
     * The toasts stand out from the page: the background of the search bar
     * in use (`--app-surface-raised`, cf. `root.css`), and, on a phone, as
     * wide as the header's items (its side margins, `px-safe-2`, also
     * under them).
     */
    toast: {
      slots: {
        root: "bg-(--app-surface-raised)",
      },
    },
    toaster: {
      slots: {
        viewport: "max-sm:w-[calc(100%-1rem-env(safe-area-inset-left)-env(safe-area-inset-right))] max-sm:right-[calc(0.5rem+env(safe-area-inset-right))] max-sm:bottom-[calc(0.5rem+env(safe-area-inset-bottom))]",
      },
    },
  },
});
