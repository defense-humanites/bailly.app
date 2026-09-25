<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";

  const props = defineProps<{
    items: NavigationMenuItem[];
  }>();

  /**
   * Below `lg`, the menu only shows its icons: their labels are then shown in
   * tooltips (and remain the links' accessible names).
   */
  const showLabels = useMediaQuery("(min-width: 64rem)");

  const menuItems = computed((): NavigationMenuItem[] =>
    props.items.map(item => ({ ...item, tooltip: !showLabels.value })),
  );
</script>

<template>
  <!--
    Below `md`, two rows: the title and the menu, then the search bar. The
    header is sticky with an offset of the first row's height (`h-12`): that
    row scrolls away with the page, and the search bar stays at the top.
    From `md`, a single floating row.
  -->
  <header
    class="sticky -top-12 z-[99] border-b border-black/10 bg-white/90 backdrop-blur-sm md:fixed md:top-3 md:h-14 md:w-dvw md:border-0 md:bg-transparent md:px-6 md:backdrop-blur-none"
  >
    <nav
      class="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 pb-2 md:flex md:h-full md:w-full md:justify-between md:gap-x-6 md:px-3 md:py-1 md:bg-radial-[at_50%_0%] md:from-75% md:from-white/50 md:to-100% md:to-primary-50/75 md:bg-white/65 md:backdrop-blur-sm md:border md:border-black/10 md:shadow-xl md:shadow-black/10 md:rounded-xl"
    >
      <ULink
        class="flex h-12 items-center font-serif text-xl tracking-wider text-black md:h-auto"
        href="/"
      >Bailly.app</ULink>
      <SearchBar class="col-span-2 row-start-2 w-full md:max-w-96" />
      <UNavigationMenu
        :items="menuItems"
        :ui="{ link: 'max-md:p-2.5', linkLabel: 'max-lg:sr-only' }"
      />
    </nav>
  </header>
</template>
