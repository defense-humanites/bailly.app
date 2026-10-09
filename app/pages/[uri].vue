<script setup lang="ts">
  import { convert } from "@humanities/greek-conversion";
  import type { OutlineItem, SenseStep } from "~/utils/sensePath";

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
   * The title row (previous entry, title, next entry): the markup and classes
   * of Nuxt UI's navigation menu (horizontal), written out, as the header's
   * (cf. `AppNavHorizontal`): its components (Reka UI's navigation menu,
   * collections, tooltips) cost much to render on the server. Without them,
   * no arrow keys between the links (the tab key, as for any links; the
   * arrows of the page itself lead to the neighbouring entries, cf. below).
   * The items without Nuxt UI's top padding (8 px above the title, under the
   * layout's own margin); a missing neighbour's item stays, empty, to keep
   * the title centered.
   */
  const NAV = "relative flex items-center justify-between gap-1.5 [&>div]:w-full [&>div]:min-w-0";
  const LIST = "isolate flex min-w-0 items-center";
  const ITEM = "min-w-0 flex-1 pb-2";

  /** The neighbours' links, by direction (absent: none). */
  const neighbours = (["previous", "next"] as const).map(direction => ({
    direction,
    sibling: siblings[direction],
    tooltip: {
      text: direction === "previous" ? "Entrée précédente" : "Entrée suivante",
      kbds: [direction === "previous" ? "arrowleft" : "arrowright"],
    },
  }));

  /**
   * The compact bar is shown once the title has scrolled under it (its
   * wrapper, of no height, is stuck under the header then).
   */
  const title = useTemplateRef<HTMLElement>("title");
  const compactBar = useTemplateRef<ComponentPublicInstance>("compactBar");
  const compactBarShown = ref(false);
  const { y } = usePageScroll();

  /**
   * The path to the sense being read, in the compact bar (cf. `sensePath`):
   * the sense whose top has passed a reading line, a quarter down the window
   * (as `useCurrentSection`'s), not higher than the bar's bottom edge: the
   * sense in view rather than the one passing under the bar. None while the
   * bar is hidden, nor in a definition's head. The sense being read is also
   * the one the outline marks (in a group of homonyms, in one's head, or
   * in a short one, the homonym itself).
   */
  const article = useTemplateRef<HTMLElement>("article");
  const pageScroller = usePageScroller();
  const currentSense = shallowRef<Element | null>(null);
  const sensePathShown = ref<SenseStep[]>([]);

  /** The reading line, from the viewport's top. */
  const readingLine = (): number | undefined => {
    const barBottom = (compactBar.value?.$el as HTMLElement | undefined)?.firstElementChild?.getBoundingClientRect().bottom;
    return barBottom === undefined ? undefined : Math.max(barBottom, window.innerHeight / 4);
  };

  /**
   * A sense chosen in the outline is the one being read, though it may not
   * reach the reading line (the last ones, near the page's bottom), until
   * the user scrolls the page by themselves (not the outline's column).
   */
  let followed: Element | null = null;
  useUserScroll((event) => {
    if (!followed || (event.target instanceof Element && event.target.closest("[data-outline]"))) return;
    followed = null;
    updateSensePath();
  });

  /**
   * For a group of homonyms, the number of the one being read (cf.
   * `numberHeadword`), after the word in the compact bar: the one holding
   * the sense being read, or whose top has passed the reading line (its
   * head, before its senses; a short one, without any). None above the
   * first one.
   */
  const homonymShown = ref("");
  // The address following it (`#2`, none above the first one, or while the
  // title is in view), as the privacy page's sections (cf.
  // `useAddressAnchor`): a link to it, or the way back, lands on it.
  watch(homonymShown, useAddressAnchor());

  const updateSensePath = (): void => {
    const line = readingLine();
    const definitions = article.value ? [...article.value.querySelectorAll(".definition")] : [];
    const senses = definitions.flatMap(sensesIn);
    // At the bottom of the page, the last homonym (a short one may never
    // reach the reading line).
    const box = pageScroller.value;
    const atBottom = !!box && box.scrollTop > 0 && box.clientHeight + box.scrollTop >= box.scrollHeight - 2;
    const definition = followed?.closest(".definition") ?? (atBottom && definitions.length > 1 ? definitions.at(-1)! : line === undefined ? null : senseAt(definitions, line));
    let sense = followed ? (followed.matches(".definition") ? null : followed) : line === undefined ? null : senseAt(senses, line);
    // In the head of a homonym, not in the previous one's last sense.
    if (sense && definition && !definition.contains(sense)) sense = null;
    // For the outline, in a group of homonyms, the homonym itself in its
    // head (or a short one, without senses).
    currentSense.value = sense ?? (definitions.length > 1 ? definition : null);
    const path = compactBarShown.value ? sensePath(sense) : [];
    // Only when it changes (the bar re-rendered otherwise).
    if (JSON.stringify(path) !== JSON.stringify(sensePathShown.value)) sensePathShown.value = path;
    homonymShown.value = compactBarShown.value && definitions.length > 1 ? definition?.querySelector(".entreea .homonym")?.textContent ?? "" : "";
  };

  /**
   * A long entry's outline (cf. `entryOutline`, `outlineWorthy`), read from
   * its definitions once rendered: in a column beside the card from `xl`,
   * from the compact bar below. Only if an item starts out of the first
   * screen (its top, the page at its top, in the page's last tenth,
   * `FOLD_SHARE`, at least `FOLD_MARGIN` px, or below: a number barely
   * in view, its text not): read again when that may change, as the
   * entry's size (the width, the reading font's size, the Greek
   * transliterated or not) or the window's height, by more than
   * `HEIGHT_CHANGE` (not a phone's toolbars, folding as the page scrolls:
   * no outline coming or going while reading).
   */
  const FOLD_SHARE = 0.1;
  const FOLD_MARGIN = 40;
  const HEIGHT_CHANGE = 0.15;
  const beyondFold = (element: Element): boolean => {
    const box = pageScroller.value;
    const top = element.getBoundingClientRect().top - (box?.getBoundingClientRect().top ?? 0) + (box?.scrollTop ?? 0);
    const height = box?.clientHeight ?? window.innerHeight;
    return top > height - Math.max(FOLD_MARGIN, height * FOLD_SHARE);
  };
  const outline = shallowRef<OutlineItem[]>([]);
  let measuredHeight = 0;
  const readOutline = (): void => {
    measuredHeight = window.innerHeight;
    const items = article.value ? entryOutline(article.value) : [];
    const shown = outlineWorthy(items, beyondFold) ? items : [];
    // Only when it changes (the outline re-rendered otherwise).
    const same = shown.length === outline.value.length && shown.every((item, index) => item.element === outline.value[index]!.element && item.label === outline.value[index]!.label);
    if (!same) outline.value = shown;
    updateSensePath();
  };
  onMounted(readOutline);
  watch(greek.transliterated, () => nextTick(readOutline));
  const readOutlineSoon = useDebounceFn(readOutline, 150);
  useResizeObserver(article, () => {
    void readOutlineSoon();
  });
  useEventListener(window, "resize", () => {
    if (Math.abs(window.innerHeight - measuredHeight) > measuredHeight * HEIGHT_CHANGE) void readOutlineSoon();
  });

  /**
   * Brings an item of the outline into view: its top just above the reading
   * line, where it is the sense being read (marked as such at once, and
   * followed: cf. above), then points it out (`pointOut`).
   */
  const goToSense = (item: OutlineItem): void => {
    const line = readingLine();
    const scroller = usePageScroller().value;
    if (line === undefined || !scroller) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    followed = item.element;
    updateSensePath();
    scroller.scrollBy({ top: item.element.getBoundingClientRect().top - line + 4, behavior: reduced ? "instant" : "smooth" });
    // Pointed out once reached, as the cards of an ambiguous form's page
    // (in gold, cf. `components.css`): where it is, if the page can't bring
    // it to the reading line. Not if another sense is previewed meanwhile
    // (one pointed out at a time, cf. `EntryOutline`).
    const element = item.element;
    if (element instanceof HTMLElement) {
      afterScroll(() => {
        const previewed = document.querySelector(".definition [data-outline-preview]");
        if (!previewed || previewed === element) pointOut(element);
      });
    }
  };

  /**
   * While the page scrolls, the path stays as it is: it changes once the
   * scroll has stopped (a fast scroll through ten senses changes it once,
   * when the reader looks at it), rather than at each sense passing by. The
   * scroll's end as the browser tells it (`scrollend`, after an inertial
   * scroll too); else, 150 ms without a scroll.
   */
  const SCROLL_END = import.meta.client && "onscrollend" in window;
  const updateSensePathLater = useDebounceFn(updateSensePath, 150);
  useEventListener(usePageScroller(), "scrollend", updateSensePath);

  const updateCompactBar = (): void => {
    const barTop = (compactBar.value?.$el as HTMLElement | undefined)?.getBoundingClientRect().top;
    const titleBottom = title.value?.getBoundingClientRect().bottom;
    if (barTop === undefined || titleBottom === undefined) return;
    const wasShown = compactBarShown.value;
    compactBarShown.value = titleBottom <= barTop;
    // The bar shown or hidden: its path at once.
    if (compactBarShown.value !== wasShown) updateSensePath();
    else if (!SCROLL_END) void updateSensePathLater();
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

  // The headwords are bold: their face is fetched with the page.
  usePreloadBoldFace();

  useSeoMeta({
    title: `${entry.word.replace(/\u03D0/g, "β")} (${convert(entry.word, "greek", "transliteration", { preset: "ala-lc-ancient" })})`,
    description: entry.excerpt,
  });
</script>

<template>
  <article ref="article">
    <EntryCompactBar
      ref="compactBar"
      :word="greek.text(entry.word)"
      :siblings="siblings"
      :shown="compactBarShown"
      :homonyms="!!entry.children?.length"
      :homonym="homonymShown"
      :path="sensePathShown"
      :outline="outline"
      :current="currentSense"
      @select="goToSense"
    />
    <header ref="title">
      <!--
        The links' hover is the header menu's (`bg-elevated`, Nuxt UI's, is
        the page's own color in the light theme). The title: homonyms
        (several entries under one word) told by a fan of cards.
      -->
      <nav :class="NAV">
        <div class="relative">
          <ul :class="LIST">
            <template
              v-for="(neighbour, index) in neighbours"
              :key="neighbour.direction"
            >
              <li
                v-if="index === 1"
                class="min-w-0 grow pb-2"
              >
                <h1
                  data-slot="link"
                  class="relative flex w-full items-center justify-center gap-1.5 px-2.5 py-1.5 text-center font-serif text-2xl font-bold text-highlighted"
                >
                  <UIcon
                    v-if="entry.children?.length"
                    name="i-lucide-playing-cards-fan"
                    data-slot="linkLeadingIcon"
                    class="size-6 shrink-0 text-muted"
                  />
                  <span
                    data-slot="linkLabel"
                    class="truncate"
                  >{{ greek.text(entry.word) }}</span>
                </h1>
              </li>
              <li :class="ITEM">
                <ClientOnly v-if="neighbour.sibling">
                  <UTooltip v-bind="neighbour.tooltip">
                    <EntryHeaderLink
                      :to="`/${neighbour.sibling.uri}`"
                      :word="greek.text(neighbour.sibling.word)"
                      :direction="neighbour.direction"
                    />
                  </UTooltip>
                  <template #fallback>
                    <EntryHeaderLink
                      :to="`/${neighbour.sibling.uri}`"
                      :word="greek.text(neighbour.sibling.word)"
                      :direction="neighbour.direction"
                    />
                  </template>
                </ClientOnly>
              </li>
            </template>
          </ul>
        </div>
      </nav>
    </header>
    <!--
      From `xl`, a long entry's outline in a column beside the card (as the
      headwords of an ambiguous form's page), sticking under the header, its
      own scroller if taller than the window. Titled as the privacy page's
      column (« Sommaire »), the title staying in place above the scroller;
      hidden from screen readers, which hear the outline's own name.
    -->
    <section class="relative">
      <EntryCard
        :entry="entry"
        toolbar
      />
      <aside
        v-if="outline.length"
        class="absolute start-full top-0 ms-12 hidden h-full w-56 xl:block"
      >
        <div class="sticky top-[calc(var(--header-bottom)+1.5rem)] flex max-h-[calc(100dvh-var(--header-bottom)-3rem)] flex-col">
          <p
            aria-hidden="true"
            class="mb-2 px-2.5 text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Sommaire
          </p>
          <div class="min-h-0 overflow-y-auto">
            <EntryOutline
              :items="outline"
              :current="currentSense"
              collapse
              @select="goToSense"
            />
          </div>
        </div>
      </aside>
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
