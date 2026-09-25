<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import AppNavHorizontal from "./@ui/AppNavHorizontal.vue";

  const items = ref<NavigationMenuItem[]>([
    {
      label: "Signets",
      icon: "i-lucide-bookmark",
      to: "/signets",
    },
    {
      label: "Paramètres",
      icon: "i-lucide-sliders-horizontal",
      to: encodeURI("/paramètres"),
    },
    {
      label: "À propos",
      icon: "i-lucide-info",
      to: encodeURI("/à-propos"),
    },
  ]);
</script>

<template>
  <!-- @TODO Add a horizontal/verical navigation switch. -->
  <AppNavHorizontal :items="items" />
</template>
