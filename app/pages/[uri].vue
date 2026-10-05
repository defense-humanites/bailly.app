<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import { convert } from "@humanities/greek-conversion";

  definePageMeta({
    layout: "single-column",
  });

  const route = useRoute();
  const uri = String(route.params.uri);

  const { data, error } = await useApiEntry(uri, {
    fields: ["word", "uri", "excerpt", "htmlDefinition"],
    siblings: true,
    // Only what the links to the neighbouring entries show (not their definitions).
    siblingsFields: ["word", "uri", "excerpt"],
  });

  if (error.value) {
    throw createError({
      status: error.value.status ?? 500,
      message: "L'entrée n'a pas pu être chargée.",
    });
  }

  const entry = data.value?.entry;
  if (!entry) {
    throw createError({
      status: 404,
      message: "La page demandée n'existe pas.",
    });
  }

  // Redirect to the canonical URI (e.g. if the requested one was malformed).
  if (entry.uri !== uri) {
    await navigateTo(`/${encodeURIComponent(entry.uri)}`, { redirectCode: 301 });
  }

  const siblings = data.value?.siblings ?? {};

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
        "tooltip": { text: "Entrée précédente", kbds: ["arrowleft"] },
      }
      : placeholder,
    // The title: active (no hover effect), without the active background.
    {
      as: "h1",
      label: greek.text(entry.word),
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
        "tooltip": { text: "Entrée suivante", kbds: ["arrowright"] },
      }
      : placeholder,
  ];

  /**
   * The compact bar is shown once the title has scrolled under it (its
   * wrapper, of no height, is stuck under the header then).
   */
  const title = useTemplateRef<HTMLElement>("title");
  const compactBar = useTemplateRef<ComponentPublicInstance>("compactBar");
  const compactBarShown = ref(false);
  const { y } = usePageScroll();

  const updateCompactBar = (): void => {
    const barTop = (compactBar.value?.$el as HTMLElement | undefined)?.getBoundingClientRect().top;
    const titleBottom = title.value?.getBoundingClientRect().bottom;
    if (barTop === undefined || titleBottom === undefined) return;
    compactBarShown.value = titleBottom <= barTop;
  };

  onMounted(updateCompactBar);
  watch(y, () => requestAnimationFrame(updateCompactBar));

  /**
   * Keyboard: the left and right arrows lead to the previous and next
   * entries, while the focus is on the page itself or its text: not on a
   * link, a button or a control (e.g. the search input, a menu, a panel),
   * which may use them (but the pages' scroller, focusable, cf.
   * `PageScroller`), nor with a modifier (e.g. Alt+← goes back in the
   * history of Windows and Linux browsers).
   */
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const sibling = { ArrowLeft: siblings.previous, ArrowRight: siblings.next }[event.key];
    if (!sibling) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, textarea, select, summary, [contenteditable], [tabindex]:not(#page), [role=dialog], [role=listbox], [role=menu], [role=radiogroup], [role=slider], [role=tablist]")) return;
    event.preventDefault();
    void navigateTo(`/${sibling.uri}`);
  });

  useSeoMeta({
    title: `${entry.word.replace(/\u03D0/g, "β")} (${convert(entry.word, "greek", "transliteration", { preset: "ala-lc-ancient" })})`,
    description: entry.excerpt,
  });
</script>

<template>
  <article>
    <EntryCompactBar
      ref="compactBar"
      :word="greek.text(entry.word)"
      :siblings="siblings"
      :shown="compactBarShown"
    />
    <header ref="title">
      <UNavigationMenu
        :ui="{
          root: '[&>div]:w-full',
          item: '[&:not(:has(h1))]:flex-1 [&:has(h1)]:grow',
          link: 'font-serif font-bold text-base/7',
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
      The links to the neighbouring entries, again after the entry, on every
      screen (on mobile, the header only has arrows).
    -->
    <footer class="mt-8">
      <EntrySurround :siblings="siblings" />
    </footer>
  </article>
</template>
