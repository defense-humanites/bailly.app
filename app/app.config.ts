export default defineAppConfig({
  ui: {
    colors: {
      primary: "hot-cinnamon",
      secondary: "domino",
      neutral: "gray",
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
          "2xl": {
            base: "px-3.5 py-2.5 text-base",
            leadingIcon: "size-6 mr-1.5",
            leadingAvatarSize: "xs",
            trailingIcon: "size-6 ml-1.5",
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
            root: "bg-default ring ring-default -bg-linear-45 from-0% from-primary-50/50 to-25% to-white",
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
