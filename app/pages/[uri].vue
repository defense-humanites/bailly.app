<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import { convert } from "@humanities/greek-conversion";

  definePageMeta({
    layout: "single-column"
  });

  let items = ref<NavigationMenuItem[]>();

  const route = useRoute();
  const { status, data: payload } = await useApiEntry(
    String(route.params.uri),
    {
      fields: ["word", "uri", "excerpt", "htmlDefinition"],
      siblings: true,
    }
  );

  if (payload.value) {
    const { entry, siblings } = payload.value.data;

    items.value = [
      siblings.previous?.word ? {
        label: siblings.previous?.word,
        icon: 'i-heroicons-arrow-left',
        to: `/${siblings.previous?.uri}`
      } : {},
      {
        as: "h1",
        label: entry.word,
        trailingIcon: entry.children ? "i-heroicons-square-2-stack" : undefined,
        active: true,
        class: "text-2xl text-center"
      },
      siblings.next?.word ? {
        label: siblings.next?.word,
        trailingIcon: 'i-heroicons-arrow-right',
        to: `/${siblings.next?.uri}`,
        class: 'text-right'
      } : {},
    ];

    if (!entry.word) {
      throw createError({
        statusCode: 404,
        statusMessage: "La page demandée n'existe pas."
      });
    }

    useSeoMeta({
      title: `${entry.word.replace(/\u03D0/g, "β")} (${convert(entry.word, "greek", "transliteration", { preset: "ala-lc-ancient" })})`,
      description: entry.excerpt
    });
  }
</script>

<template>
  <article>
    <header>
      <UNavigationMenu :ui="{
        root: '[&>div]:w-full',
        item: '[&:not(:has(h1))]:flex-1 [&:has(h1)]:grow',
        link: 'font-serif font-bold text-xl',
        linkLabel: 'grow',
      }" :items="items" color="neutral" />
    </header>
    <section v-if="payload?.data.entry">
      <EntryCard :entry="payload.data.entry" toolbar />
    </section>
  </article>
</template>