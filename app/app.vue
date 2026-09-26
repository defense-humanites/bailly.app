<script setup lang="ts">
  import type { ToasterProps } from "@nuxt/ui";

  /**
   * Nuxt UI toaster component configuration.
   */
  const toaster: ToasterProps = {
    expand: false,
    progress: false,
  };

  /**
   * The reading preferences, as attributes of the root element (cf.
   * `--reading-font-size`), rendered by the server too.
   */
  const { preference } = usePreferences();
  const readingSize = preference("readingSize");
  const readingWeight = preference("readingWeight");

  useHead({
    titleTemplate: (title) => {
      return title ? title : "Bailly.app — Dictionnaire grec-français en ligne";
    },
    meta: [
      {
        name: "description",
        content:
          "Consultez le dictionnaire grec–français d'Anatole Bailly dans l'édition Bailly 2020 Hugo Chávez.",
      },
    ],
    htmlAttrs: {
      "lang": "fr",
      "data-reading-size": readingSize,
      "data-reading-weight": readingWeight,
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
