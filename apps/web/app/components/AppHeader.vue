<script setup lang="ts">
  import AppNavHorizontal from "./AppNavHorizontal.vue";

  /** A link of the header's menu. */
  export type HeaderLink = { label: string; icon: string; to: string };

  const items: HeaderLink[] = [
    {
      label: "Signets",
      icon: "i-lucide-bookmark",
      to: "/signets",
    },
    {
      label: "Préférences",
      icon: "i-lucide-sliders-horizontal",
      to: encodeURI("/préférences"),
    },
    {
      label: "À propos",
      icon: "i-lucide-info",
      to: encodeURI("/à-propos"),
    },
  ];
</script>

<template>
  <!-- @TODO Add a horizontal/verical navigation switch. -->
  <AppNavHorizontal :items="items" />
</template>
