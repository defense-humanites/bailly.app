<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import { convert } from "@humanities/greek-conversion";

  definePageMeta({
    layout: "single-column",
  });

  const route = useRoute();
  const uri = String(route.params.uri);

  const { data: payload, error } = await useApiEntry(uri, {
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    siblings: true,
  });

  if (error.value) {
    throw createError({
      status: error.value.status ?? 500,
      statusText: "L'entrée n'a pas pu être chargée.",
    });
  }

  // The API answers unknown URIs with an empty entry.
  const entry = payload.value?.data.entry;
  if (!entry?.word) {
    throw createError({
      status: 404,
      statusText: "La page demandée n'existe pas.",
    });
  }

  // Redirect to the canonical URI (e.g. if the requested one was malformed).
  if (entry.uri !== uri) {
    await navigateTo(`/${encodeURIComponent(entry.uri)}`, { redirectCode: 301 });
  }

  const siblings = payload.value?.data.siblings ?? {};

  /**
   * Keeps the title centered when there is no previous/next entry.
   */
  const placeholder: NavigationMenuItem = { disabled: true, class: "invisible" };

  const items: NavigationMenuItem[] = [
    siblings.previous
      ? {
        label: siblings.previous.word,
        icon: "i-lucide-arrow-left",
        to: `/${siblings.previous.uri}`,
      }
      : placeholder,
    {
      as: "h1",
      label: entry.word,
      trailingIcon: entry.children?.length ? "i-lucide-layers" : undefined,
      active: true,
      class: "text-2xl text-center",
    },
    siblings.next
      ? {
        label: siblings.next.word,
        trailingIcon: "i-lucide-arrow-right",
        to: `/${siblings.next.uri}`,
        class: "text-right",
      }
      : placeholder,
  ];

  useSeoMeta({
    title: `${entry.word.replace(/\u03D0/g, "β")} (${convert(entry.word, "greek", "transliteration", { preset: "ala-lc-ancient" })})`,
    description: entry.excerpt,
  });
</script>

<template>
  <article>
    <header>
      <UNavigationMenu
        :ui="{
          root: '[&>div]:w-full',
          item: '[&:not(:has(h1))]:flex-1 [&:has(h1)]:grow',
          link: 'font-serif font-bold text-xl',
          linkLabel: 'grow',
        }"
        :items="items"
        color="neutral"
      />
    </header>
    <section v-if="payload?.data.entry">
      <EntryCard
        :entry="payload.data.entry"
        toolbar
      />
    </section>
  </article>
</template>
