<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import { convert } from "@humanities/greek-conversion";
  import { definitionLength, isLongDefinition } from "~/utils/definitionLength";

  definePageMeta({
    layout: "single-column",
  });

  const route = useRoute();
  const uri = String(route.params.uri);

  const { data, error } = await useApiEntry(uri, {
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    siblings: true,
  });

  if (error.value) {
    throw createError({
      status: error.value.status ?? 500,
      statusText: "L'entrée n'a pas pu être chargée.",
    });
  }

  const entry = data.value?.entry;
  if (!entry) {
    throw createError({
      status: 404,
      statusText: "La page demandée n'existe pas.",
    });
  }

  // Redirect to the canonical URI (e.g. if the requested one was malformed).
  if (entry.uri !== uri) {
    await navigateTo(`/${encodeURIComponent(entry.uri)}`, { redirectCode: 301 });
  }

  const siblings = data.value?.siblings ?? {};

  /**
   * Whether the definition (or those of the homonyms) is long, at the chosen
   * reading size.
   */
  const readingSize = usePreferences().preference("readingSize");
  const textLength = [entry, ...(entry.children ?? [])]
    .reduce((length, { htmlDefinition }) => length + definitionLength(htmlDefinition), 0);
  const longDefinition = computed((): boolean => isLongDefinition(textLength, readingSize.value));

  // Greek may be transliterated (a preference).
  const greek = useGreek();

  // The entry is added to the history of the viewed entries (in the browser).
  const historyStore = useHistoryStore();
  onMounted(() => {
    void historyStore.add(entry);
  });

  /**
   * Keeps the title centered when there is no previous/next entry.
   */
  const placeholder: NavigationMenuItem = { disabled: true, class: "invisible" };

  const items: NavigationMenuItem[] = [
    siblings.previous
      ? {
        "label": greek.text(siblings.previous.word),
        "icon": "i-lucide-arrow-left",
        "to": `/${siblings.previous.uri}`,
        "aria-label": `Entrée précédente : ${greek.text(siblings.previous.word)}`,
        "ui": { linkLabel: "max-sm:sr-only" },
      }
      : placeholder,
    // The title: active (no hover effect), without the active background.
    {
      as: "h1",
      label: greek.text(entry.word),
      trailingIcon: entry.children?.length ? "i-lucide-layers" : undefined,
      active: true,
      class: "text-2xl text-center before:bg-transparent",
    },
    siblings.next
      ? {
        "label": greek.text(siblings.next.word),
        "trailingIcon": "i-lucide-arrow-right",
        "to": `/${siblings.next.uri}`,
        "aria-label": `Entrée suivante : ${greek.text(siblings.next.word)}`,
        "class": "justify-end text-right",
        "ui": { linkLabel: "max-sm:sr-only" },
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
    <!--
      The title and the links to the neighbouring entries stick under the
      header (cf. `--header-bottom`, which follows the mobile title row), on
      an almost opaque background; a line under them once they are stuck,
      where supported (cf. `.entry-header`).
    -->
    <header class="entry-header sticky top-(--header-bottom) z-20 -mx-2 bg-white/95 px-2 backdrop-blur-sm transition-[top] duration-300 ease-out motion-reduce:transition-none">
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
    <section>
      <EntryCard
        :entry="entry"
        toolbar
      />
    </section>
    <!--
      The links to the neighbouring entries, again after the entry: always
      below lg (only arrows in the header on mobile), and on desktop only
      after a long definition (the header's are then out of sight).
    -->
    <footer
      class="mt-8"
      :class="{ 'lg:hidden': !longDefinition }"
    >
      <EntrySurround :siblings="siblings" />
    </footer>
  </article>
</template>
