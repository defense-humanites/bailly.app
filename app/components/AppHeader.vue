<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import AppNavHorizontal from "./@ui/AppNavHorizontal.vue";

  const items = ref<NavigationMenuItem[]>([
    {
      label: "Signets",
      icon: "i-heroicons-bookmark",
      to: "/signets",
    },
    {
      label: "Paramètres",
      icon: "i-heroicons-adjustments-horizontal",
      to: encodeURI("/paramètres"),
    },
    {
      label: "À propos",
      icon: "i-heroicons-information-circle",
      to: encodeURI("/à-propos"),
    },
  ]);
</script>

<template>
  <!-- @TODO Add a horizontal/verical navigation switch. -->
  <AppNavHorizontal :items="items" />
</template>
