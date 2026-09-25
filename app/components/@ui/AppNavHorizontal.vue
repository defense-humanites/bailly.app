<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";

  defineProps<{
    items: NavigationMenuItem[];
  }>();
</script>

<template>
  <header class="h-14 fixed top-3 z-[99] w-dvw px-6">
    <nav
      class="h-full flex items-center justify-between w-full px-3 py-1 bg-radial-[at_50%_0%] from-75% from-white/50 to-100% to-primary-50/75 bg-white/65 backdrop-blur-sm border border-black/10 shadow-xl shadow-black/10 rounded-xl"
    >
      <ULink
        class="font-serif text-xl tracking-wider text-black"
        href="/"
      >Bailly.app</ULink>
      <SearchBar class="w-full max-w-96" />
      <UNavigationMenu :items="items" />
    </nav>
  </header>
</template>
