export default defineAppConfig({
  ui: {
    // The palette « Grèce classique » (cf. `assets/css/theme.css`).
    colors: {
      primary: "aegean",
      secondary: "terracotta",
      info: "aegean",
      warning: "gold",
      neutral: "marble",
    },
    /*
     * Rounded buttons (pills), except the ghost ones, used in lists and
     * toolbars. Only the solid buttons (main actions) have a drop shadow and a
     * semibold text; the outline ones a slight shadow; the others none.
     */
    button: {
      slots: {
        base: "rounded-full",
      },
      variants: {
        variant: {
          solid: { base: "shadow-lg shadow-black/10 font-semibold" },
          outline: { base: "shadow-xs" },
          ghost: { base: "rounded-md" },
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
