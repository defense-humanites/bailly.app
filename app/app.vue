<script setup lang="ts">
  import type { ToasterProps } from "@nuxt/ui";
  import { useBookmarksStore } from "./stores/bookmarks";
  import { Idb } from "./idb";

  const runtimeConfig = useRuntimeConfig();

  /**
   * Nuxt UI toaster component configuration.
   */
  const toaster: ToasterProps = {
    expand: false,
    progress: false
  };

  /**
   * Configures the Idb instance and initializes the bookmarks store.
   * @remarks The app must be mounted to initialize the store as it deals with browser storage.
   */
  onMounted(async () => {
    Idb.configure({
      searchHistoryLength: Number(runtimeConfig.public.searchHistoryLength),
      tagMaxItems: Number(runtimeConfig.public.tagMaxItems),
      maxTags: Number(runtimeConfig.public.maxTags),
    });

    await useBookmarksStore().initialize();
  });

  useHead({
    titleTemplate: (title) => {
      return title ? title : 'Bailly.app — Dictionnaire grec-français en ligne';
    },
    meta: [
      {
        name: "description",
        content:
          "Consultez le dictionnaire grec–français d'Anatole Bailly dans l'édition Bailly 2020 Hugo Chávez.",
      },
    ],
    htmlAttrs: {
      lang: "fr",
    },
    link: [
      { rel: "icon", type: "image/png", href: "/favicon/favicon-96x96.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon/favicon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon/favicon.ico" },
      {
        rel: "icon",
        type: "image/x-icon",
        href: "/favicon/favicon-dark.ico",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/favicon/apple-touch-icon.png",
      },
    ],
  });
</script>

<template>
  <NuxtRouteAnnouncer />
  <UApp :toaster="toaster">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
