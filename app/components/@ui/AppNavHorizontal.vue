<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";

  const props = defineProps<{
    items: NavigationMenuItem[];
  }>();

  /**
   * Below `lg`, the menu only shows its icons: their labels are then shown in
   * tooltips (and remain the links' accessible names).
   * @remarks The tooltips are disabled rather than removed from `lg`: the
   * server doesn't know the viewport width, and the markup must not change
   * after hydration.
   */
  const showLabels = useMediaQuery("(min-width: 64rem)");

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
    content: the layout doesn't change. From `md`, a single floating row, at
    most `6xl` wide, on a grid shared with the single-column layout (whose
    column thus lies under the search bar): fixed tracks for the title and the
    menu, the search bar taking the space left (cf. `grid-cols-header`).
  -->
  <header
    ref="header"
    class="sticky z-[99] border-b border-black/10 bg-white/90 backdrop-blur-sm transition-[top] duration-300 ease-out motion-reduce:transition-none md:fixed md:inset-x-0 md:top-3 md:h-14 md:border-0 md:bg-transparent md:px-6 md:backdrop-blur-none md:transition-none"
    :class="titleRowShown ? 'top-0' : '-top-12'"
  >
    <nav
      class="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 pb-2 md:mx-auto md:grid-cols-header md:h-full md:w-full md:max-w-(--header-max-width) md:px-3 md:py-1 md:bg-radial-[at_50%_0%] md:from-75% md:from-white/50 md:to-100% md:to-primary-50/75 md:bg-white/65 md:backdrop-blur-sm md:border md:border-black/10 md:shadow-xl md:shadow-black/10 md:rounded-xl"
    >
      <ULink
        class="flex h-12 items-center font-serif text-xl tracking-wider text-black md:h-auto"
        href="/"
      >Bailly.app</ULink>
      <SearchBar class="col-span-2 row-start-2 w-full md:col-span-1 md:col-start-2 md:row-start-1" />
      <UNavigationMenu
        class="md:col-start-3 md:row-start-1 md:justify-self-end"
        :items="menuItems"
        :ui="{ link: 'max-md:p-2.5', linkLabel: 'max-lg:sr-only' }"
      />
    </nav>
  </header>
</template>
