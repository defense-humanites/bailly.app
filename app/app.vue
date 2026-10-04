<script setup lang="ts">
  import type { ToasterProps } from "@nuxt/ui";

  /**
   * Nuxt UI toaster component configuration.
   */
  const toaster: ToasterProps = {
    expand: false,
    progress: false,
  };

  useAppShell();
</script>

<template>
  <NuxtRouteAnnouncer />
  <UApp :toaster="toaster">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
