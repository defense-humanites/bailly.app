<script setup lang="ts">
  import type { ToasterProps } from "@nuxt/ui";
  import { READING_FONTS } from "~/utils/fonts";

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
  const readingFont = preference("readingFont");
  const readingSize = preference("readingSize");
  const readingWeight = preference("readingWeight");

  // The theme, a preference that the color mode applies.
  if (import.meta.client) useThemePreference();

  /**
   * The audience measurement (Simple Analytics: no cookie, no IP address
   * kept), on the production host only (cf. `analyticsHost`).
   */
  const { analyticsHost } = useRuntimeConfig().public;
  const analytics = analyticsHost !== "" && useRequestURL().hostname === analyticsHost;

  useHead({
    script: analytics
      ? [{ src: "https://scripts.simpleanalyticscdn.com/latest.js", async: true, tagPosition: "bodyClose" }]
      : [],
    titleTemplate: (title) => {
      return title ? title : "Bailly.app — Dictionnaire grec-français en ligne";
    },
    meta: [
      {
        name: "description",
        content:
          "Consultez le dictionnaire grec-français d'Anatole Bailly, dans une application libre et gratuite.",
      },
    ],
    htmlAttrs: {
      "lang": "fr",
      "data-reading-font": readingFont,
      "data-reading-size": readingSize,
      "data-reading-weight": readingWeight,
    },
    link: [
      // The face of the entries' text (the chosen font and weight), known
      // by the server: fetched as soon as possible.
      computed(() => {
        const href = READING_FONTS[readingFont.value].files[readingWeight.value];
        return { rel: "preload", as: "font", type: "font/woff2", href, crossorigin: "anonymous" };
      }),
      { rel: "icon", type: "image/png", href: "/favicon/favicon-96x96.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon/favicon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon/favicon.ico" },
      {
        rel: "icon",
        type: "image/x-icon",
        href: "/favicon/favicon-dark.ico",
        media: "(prefers-color-scheme: dark)",
      },
      { rel: "manifest", href: "/site.webmanifest" },
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
