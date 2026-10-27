<script setup lang="ts">
  import type { ToasterProps } from "@nuxt/ui";
  import { SITE_URL } from "#shared/utils/site";

  /**
   * Nuxt UI toaster component configuration.
   */
  const toaster: ToasterProps = {
    expand: false,
    progress: false,
  };

  useAppShell();

  /**
   * The page's canonical address: on the site's host, its path without the
   * query (e.g. an entry reached with parameters, or on a preview), so that
   * the search engines gather the signals on one address; readable, its
   * path decoded (`/à-propos`, valid in HTML; the address Zotero's connector
   * saves). Not on the error page (`error.vue`, which replaces this
   * component).
   */
  const route = useRoute();
  // (A malformed path, e.g. `/%E0`, kept as it is.)
  const readablePath = (path: string): string => {
    try {
      return decodeURI(path);
    } catch {
      return path;
    }
  };
  useHead({
    link: [computed(() => ({ rel: "canonical", href: `${SITE_URL}${readablePath(route.path)}` }))],
  });

  /**
   * For the reference managers, every page describes the dictionary itself
   * (cf. `workMetadata`): Zotero's connector, offered on any page, saves the
   * work rather than the application's pages (bookmarks, preferences…);
   * an entry's page replaces it by the entry's (`[uri].vue`, the tags of
   * the same names).
   */
  useHead({ meta: workMetadata() });
</script>

<template>
  <NuxtRouteAnnouncer />
  <UApp :toaster="toaster">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
