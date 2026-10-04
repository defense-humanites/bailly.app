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
   * On a page whose top is a cover (`headerCover` in its meta: the about
   * page's hero), the header's items are hidden (transparent) while the page
   * is at its top, the header keeping its height and background (which frame
   * the cover). They fade in as the page scrolls, over its first
   * `COVER_REVEAL` pixels (the opacity follows the scroll, its transition
   * smoothing a wheel's steps), and show meanwhile when hovered, focused
   * (e.g. with the keyboard) or while one of their panels is open (the
   * results, the history, the search options: `aria-expanded`). Only from
   * `md` (on one row) and with a fine pointer: the two rows' header, and a
   * touch screen, which can't reveal it by hovering, always show them.
   * Rendered so by the server (the page opens at its top; the conditions are
   * media queries): no flash.
   */
  const COVER_REVEAL = 128;
  const route = useRoute();
  const coverOpacity = computed((): number | null => {
    if (route.meta.headerCover !== true) return null;
    const opacity = Math.min(1, Math.max(0, y.value) / COVER_REVEAL);
    return opacity < 1 ? opacity : null;
  });

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
    The header is anchored (top and sides), on an opaque background:
    the content doesn't show around it. Its bottom border only appears once
    the content scrolls under it.
  -->
  <header
    class="group/header fixed inset-x-0 top-0 z-[99] overflow-hidden border-b [scrollbar-gutter:stable] bg-bar transition-[border-color] duration-300 ease-out motion-reduce:transition-none md:h-(--header-height) md:px-safe-6"
    :class="[scrolled && !extended ? 'border-default' : 'border-transparent']"
  >
    <nav
      class="grid grid-cols-[1fr_auto] items-center gap-x-3 pb-2 transition-opacity duration-150 ease-out max-md:px-safe-2 motion-reduce:transition-none md:mx-auto md:grid-cols-header md:h-full md:w-full md:max-w-(--header-max-width) md:pb-0"
      :class="coverOpacity !== null && [
        'md:pointer-fine:opacity-(--cover-opacity) md:pointer-fine:group-hover/header:opacity-100 md:pointer-fine:focus-within:opacity-100 md:pointer-fine:has-[[aria-expanded=true]]:opacity-100',
        // Not clickable while invisible (but when hovered, or focused).
        coverOpacity === 0 && 'md:pointer-fine:pointer-events-none md:pointer-fine:group-hover/header:pointer-events-auto md:pointer-fine:focus-within:pointer-events-auto md:pointer-fine:has-[[aria-expanded=true]]:pointer-events-auto',
      ]"
      :style="coverOpacity !== null ? { '--cover-opacity': coverOpacity } : undefined"
    >
      <!--
        The title is a menu link as well: same padding as the menu (without
        its hover background), so that it lines up with the search bar as the
        menu does, and as high as the menu links whatever its font size
        (`py-1.5`, `md:py-0.5`). The logo keeps its size at every width
        (`max-w-none`, its label not clipped): the title's track, a little
        narrower from `lg`, would shrink it.
        From `md`, the menus' items lose their vertical padding (`py-2`), which
        would make the row higher than the header and push it down.
      -->
      <!--
        On mobile, on the home page only, a heart after the title leads to the
        donation (the page's own button is left out there, for room).
      -->
      <div class="flex min-w-0 items-center gap-1">
        <UNavigationMenu
          aria-label="Accueil"
          :items="[{ label: 'Bailly.app', to: '/', active: false }]"
          :ui="{ item: 'md:py-0', link: 'cursor-pointer py-1.5 md:py-0.5 hover:before:bg-transparent', linkLabel: 'overflow-visible' }"
        >
          <template #item-label>
            <img
              src="../assets/images/bailly-app-light.svg"
              alt="Bailly.app"
              class="h-7 w-auto max-w-none dark:hidden"
            >
            <img
              src="../assets/images/bailly-app-dark.svg"
              alt="Bailly.app"
              class="h-7 w-auto max-w-none hidden dark:block"
            >
          </template>
        </UNavigationMenu>
        <UButton
          v-if="route.path === '/'"
          to="/soutenir"
          icon="i-lucide-heart"
          color="primary"
          variant="ghost"
          aria-label="Nous soutenir"
          class="p-2.5 md:hidden"
          :ui="{ leadingIcon: 'size-5' }"
        />
      </div>
      <SearchBar class="col-span-2 row-start-2 w-full md:col-span-1 md:col-start-2 md:row-start-1 md:max-w-(--search-width) md:justify-self-center lg:justify-self-start" />
      <UNavigationMenu
        class="header-menu md:col-start-3 md:row-start-1 md:justify-self-end"
        :items="menuItems"
        :ui="{
          item: 'md:py-0',
          link: 'max-md:p-2.5 hover:before:bg-(--app-page-hover)/50 aria-[current=page]:before:bg-transparent',
          linkLabel: 'max-xl:sr-only',
        }"
      />
    </nav>
  </header>
</template>
