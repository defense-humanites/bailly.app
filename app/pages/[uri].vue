<script setup lang="ts">
  import type { NavigationMenuItem } from "@nuxt/ui";
  import { convert } from "@humanities/greek-conversion";
  import type { CitedEntry } from "~/utils/citation";

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

  /**
   * The entry cited (cf. `EntryCitation`): of homonyms, the one the address
   * points to (e.g. `oudos#2`), the first one otherwise; with the data's
   * version.
   */
  const citedEntry = computed((): CitedEntry => {
    const children = entry.children ?? [];
    const anchor = route.hash.slice(1);
    return children.find(child => homonymAnchor(child.uri) === anchor) ?? children[0] ?? entry;
  });
  const dataVersion = data.value?.version;

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
    // The title: active (no hover effect), without the active background;
    // homonyms (several entries under one word) told by a fan of cards.
    {
      as: "h1",
      label: greek.text(entry.word),
      ...(entry.children?.length ? { icon: "i-lucide-playing-cards-fan" } : {}),
      active: true,
      // Centered with its icon, if any (the label not growing).
      class: "justify-center text-2xl text-center before:bg-transparent hover:before:bg-transparent",
      ui: { linkLabel: "grow-0", linkLeadingIcon: "size-6 text-muted" },
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
  <article class="relative">
    <EntryCompactBar
      ref="compactBar"
      :word="greek.text(entry.word)"
      :siblings="siblings"
      :shown="compactBarShown"
      :homonyms="!!entry.children?.length"
    />
    <header ref="title">
      <!--
        The links' hover is the header menu's (`bg-elevated`, Nuxt UI's, is
        the page's own color in the light theme). The items without Nuxt UI's
        top padding (8 px above the title, under the layout's own margin).
      -->
      <UNavigationMenu
        :ui="{
          root: '[&>div]:w-full',
          item: 'pt-0 [&:not(:has(h1))]:flex-1 [&:has(h1)]:grow',
          link: 'font-serif font-bold text-base/7 hover:before:bg-(--app-page-hover)/50',
          linkLabel: 'grow',
        }"
        :items="items"
        color="neutral"
      />
    </header>
    <!--
      The entry, and from `xl` its tools on the column's right, from its
      card's top (not beside the title): the citation, sticky under the
      header (as the ambiguous forms' headwords, cf. `forme`). Below `xl`, a
      button at the card's top opens it in a window.
    -->
    <div class="relative">
      <section>
        <EntryCard
          :entry="entry"
          toolbar
        >
          <!--
            Below `xl`, the citation's button at the card's top, aligned on
            the toolbar: reached at once, however long the entry.
          -->
          <template #aside>
            <div class="relative -top-1 sm:-top-3 xl:hidden">
              <EntryCitationButton
                :entry="citedEntry"
                :version="dataVersion"
              />
            </div>
          </template>
        </EntryCard>
      </section>
      <aside
        aria-labelledby="citer"
        class="absolute start-full top-0 ms-12 hidden h-full w-64 xl:block"
      >
        <div class="sticky top-[calc(var(--header-bottom)+1.5rem)]">
          <h2
            id="citer"
            class="mb-3 flex items-center gap-2 font-semibold text-highlighted"
          >
            <UIcon
              name="i-lucide-quote"
              class="size-4 shrink-0 text-muted"
            />
            Citer cette entrée
          </h2>
          <EntryCitation
            :entry="citedEntry"
            :version="dataVersion"
          />
        </div>
      </aside>
    </div>

    <!--
      The links to the neighbouring entries, again after the entry, on every
      screen (on mobile, the header only has arrows).
    -->
    <footer class="mt-8">
      <EntrySurround :siblings="siblings" />
    </footer>
  </article>
</template>
