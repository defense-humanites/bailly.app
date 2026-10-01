<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";

  const props = defineProps<{
    items: NavigationMenuItem[];
  }>();

  /**
   * Below `xl`, the menu only shows its icons: their labels are then shown in
   * tooltips (and remain the links' accessible names).
   * @remarks The tooltips are disabled rather than removed from `xl` (cf.
   * `useButtonLabels`).
   */
  const showLabels = useButtonLabels();

  const menuItems = computed((): NavigationMenuItem[] =>
    props.items.map(item => ({ ...item, tooltip: { disabled: showLabels.value } })),
  );

  const header = useTemplateRef<HTMLElement>("header");
  const { y } = useWindowScroll();

  /**
   * Below `md`, whether the title row (and the menu) is shown again while the
   * page is scrolled: it slides back as soon as the user scrolls up, and away
   * when they scroll down. It stays as it is while the header has the focus
   * (e.g. when the mobile keyboard, opening, scrolls the page).
   */
  const titleRowShown = ref(false);

  // Exposed to what sticks under the header (cf. `--header-bottom`).
  useHead({
    htmlAttrs: { "data-header-title-row": computed(() => (titleRowShown.value ? "" : undefined)) },
  });

  /**
   * Whether the content scrolls under the header (its border then appears).
   */
  const scrolled = computed((): boolean => y.value > 0);

  /**
   * Scrolls shorter than this (in px) are ignored, e.g. iOS rubber-banding.
   */
  const SCROLL_THRESHOLD = 8;
  let lastY = 0;

  watch(y, (value) => {
    const delta = value - lastY;
    if (Math.abs(delta) < SCROLL_THRESHOLD) return;
    if (!header.value?.matches(":focus-within")) titleRowShown.value = delta < 0;
    lastY = value;
  });
</script>

<template>
  <!--
    Below `md`, two rows: the title and the menu, then the search bar. The
    header is sticky with an offset of the first row's height (`h-12`): that
    row scrolls away with the page, and the search bar stays at the top. The
    first row slides back (offset `0`) when the user scrolls up, over the
    content: the layout doesn't change. From `md`, a single row, sticky at the
    top, whose content is at most `--header-max-width` wide, on a grid shared
    with the single-column layout (whose column thus lies under the search
    bar): fixed tracks for the title and the menu, the search bar taking the
    space left up to `--search-width`, a little wider than the column under it
    (cf. `grid-cols-header` and `--search-overhang`).
    The header is anchored (top and sides), on an almost opaque background:
    the content doesn't show around it. Its bottom border only appears once
    the content scrolls under it.
  -->
  <header
    ref="header"
    class="sticky z-[99] border-b bg-bar backdrop-blur-sm transition-[top,border-color] duration-300 ease-out motion-reduce:transition-none md:top-0 md:h-14 md:px-safe-6 md:transition-[border-color]"
    :class="[titleRowShown ? 'top-0' : '-top-12', scrolled ? 'border-default' : 'border-transparent']"
  >
    <nav
      class="grid grid-cols-[1fr_auto] items-center gap-x-3 pb-2 max-md:px-safe-4 md:mx-auto md:grid-cols-header md:h-full md:w-full md:max-w-(--header-max-width) md:pb-0"
    >
      <!--
        The title is a menu link as well: same padding and hover effect as the
        menu, so that it lines up with the search bar as the menu does, and as
        high as the menu links whatever its font size (`py-1.5`, `md:py-0.5`).
        From `md`, the menus' items lose their vertical padding (`py-2`), which
        would make the row higher than the header and push it down.
      -->
      <UNavigationMenu
        aria-label="Accueil"
        :items="[{ label: 'Bailly.app', to: '/', active: false }]"
        :ui="{ item: 'md:py-0', link: 'cursor-pointer py-1.5 md:py-0.5' }"
      >
        <template #item-label>
          <img
            src="../assets/images/bailly-app-light.svg"
            alt="Bailly.app"
            class="h-7 w-auto dark:hidden"
          >
          <img
            src="../assets/images/bailly-app-dark.svg"
            alt="Bailly.app"
            class="h-7 w-auto hidden dark:block"
          >
        </template>
      </UNavigationMenu>
      <SearchBar class="col-span-2 row-start-2 w-full md:col-span-1 md:col-start-2 md:row-start-1 md:max-w-(--search-width) md:justify-self-center lg:justify-self-start" />
      <UNavigationMenu
        class="md:col-start-3 md:row-start-1 md:justify-self-end"
        :items="menuItems"
        :ui="{ item: 'md:py-0', link: 'max-md:p-2.5', linkLabel: 'max-xl:sr-only' }"
      />
    </nav>
  </header>
</template>
