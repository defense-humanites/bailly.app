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

  const { y } = usePageScroll();

  /**
   * Whether the content scrolls under the header (its border then appears).
   */
  const scrolled = computed((): boolean => y.value > 0);

  /**
   * A bar stuck under the header draws the border under both.
   */
  const extended = useHeaderExtended();
</script>

<template>
  <!--
    Below `md`, two rows: the title and the menu, then the search bar. From
    `md`, a single row. The header is fixed at the top, the pages scrolling
    under it in their own box (cf. `usePageScroller`), as on the former
    application: the window never scrolls. Below `md`, the title row used to
    scroll away with the page and slide back when scrolling up: to bring
    back if it can be done without scrolling the window. The header keeps the
    room of the pages' scrollbar (`scrollbar-gutter`, hence `overflow-hidden`,
    nothing overflowing it): both are as wide, on the same grid.
    The single row's content is at most `--header-max-width` wide, on a grid shared
    with the single-column layout (whose column thus lies under the search
    bar): fixed tracks for the title and the menu, the search bar taking the
    space left up to `--search-width`, a little wider than the column under it
    (cf. `grid-cols-header` and `--search-overhang`).
    The header is anchored (top and sides), on an almost opaque background:
    the content doesn't show around it. Its bottom border only appears once
    the content scrolls under it.
  -->
  <header
    class="fixed inset-x-0 top-0 z-[99] overflow-hidden border-b [scrollbar-gutter:stable] bg-bar backdrop-blur-sm transition-[border-color] duration-300 ease-out motion-reduce:transition-none md:h-(--header-height) md:px-safe-6"
    :class="[scrolled && !extended ? 'border-default' : 'border-transparent']"
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
