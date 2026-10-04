<script setup lang="ts">
  import type { ColorKey } from "~/enums";

  /**
   * A group of the bookmarks page, as listed in its table of contents; or,
   * without a color, a card of another page (e.g. an entry of an ambiguous
   * form's page, cf. `forme/[[forme]].vue`), in neutral colors.
   */
  export interface TocGroup {
    key: string;
    /** The id of the group's card (the link's target). */
    id: string;
    name: string;
    color?: ColorKey;
    icon?: string;
    /** Its number of entries. */
    count?: number;
    /** Whether it is the active tag (the favorites always are). */
    active?: boolean;
    /** Whether its name is Greek, in the dictionary's font. */
    serif?: boolean;
  }

  const props = withDefaults(defineProps<{
    groups: TocGroup[];
    /** The navigation's accessible name. */
    label?: string;
    /** Whether a card reached is pointed out (in its tag's color, cf. `highlightCard`). */
    highlight?: boolean;
  }>(), {
    label: "Sommaire des signets",
    highlight: true,
  });

  const route = useRoute();
  const nav = useTemplateRef<HTMLElement>("nav");
  const row = useTemplateRef<HTMLElement>("row");

  const entryCount = (count: number): string => (count < 2 ? "entrée" : "entrées");

  /**
   * Whether the table of contents is stuck under the header: its background
   * and its border then show, as the header's once the page is scrolled.
   */
  const stuck = ref(false);

  /**
   * The group being read: the card that last went under the table of
   * contents (the one a link brings there), or the one whose link was
   * followed, until the user scrolls by themselves (a card near the page's
   * bottom can't reach the table of contents). Before any card went under
   * it (e.g. under the bookmarks' introduction), the first one.
   */
  const current = ref<string>();
  let followed: string | undefined;

  /**
   * How far under the table of contents a card counts as being read: a little
   * more than the gap a link leaves above it (`--cards-gap`, cf. `signets.vue`).
   */
  const READ_LINE = 32;

  function measure(): void {
    if (!nav.value) return;
    const box = nav.value.getBoundingClientRect();
    const scrollerTop = scroller.value?.getBoundingClientRect().top ?? 0;
    stuck.value = (scroller.value?.scrollTop ?? 0) > 0
      && box.top <= scrollerTop + Number.parseFloat(getComputedStyle(nav.value).top) + 0.5;
    if (followed) {
      current.value = followed;
      return;
    }
    const line = box.bottom + READ_LINE;
    let read: { key: string; top: number } | undefined;
    for (const group of props.groups) {
      const top = document.getElementById(group.id)?.getBoundingClientRect().top;
      if (top !== undefined && top <= line && (!read || top > read.top)) read = { key: group.key, top };
    }
    current.value = read?.key ?? props.groups[0]?.key;
  }

  const scroller = usePageScroller();
  const { y } = usePageScroll();
  const { height } = useWindowSize();
  const scheduled = useRafFn(() => {
    measure();
    scheduled.pause();
  }, { immediate: false });
  watch([y, height, () => props.groups], () => {
    scheduled.resume();
  });
  onMounted(measure);

  // Stuck, it draws the border under the header too (cf. `useHeaderExtended`).
  const headerExtended = useHeaderExtended();
  watch(stuck, (value) => {
    headerExtended.value = value;
  });
  onBeforeUnmount(() => {
    headerExtended.value = false;
  });

  /**
   * The user scrolls by themselves: the followed link no longer decides.
   */
  const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const release = (): void => {
    if (!followed) return;
    followed = undefined;
    scheduled.resume();
  };
  useEventListener("wheel", release, { passive: true });
  useEventListener("touchmove", release, { passive: true });
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key) && !(event.target as Element | null)?.closest("input, textarea, [contenteditable]")) release();
  });

  /**
   * Follows a link: its group is being read, and its card, once reached, is
   * pointed out (cf. `highlightCard`).
   */
  const follow = (group: TocGroup): void => {
    followed = current.value = group.key;
    const card = document.getElementById(group.id);
    if (card && props.highlight) highlightCard(card);
  };

  /**
   * The row's scroll: whether it overflows on either side (its edges then
   * fade, and arrows show from `md` with a fine pointer).
   */
  const { arrivedState, measure: measureRow } = useScroll(row);
  const overflows = ref(false);
  function measureOverflow(): void {
    measureRow();
    overflows.value = !!row.value && row.value.scrollWidth > row.value.clientWidth + 1;
  }
  useResizeObserver(row, () => {
    measureOverflow();
    placeMark();
  });
  watch(() => props.groups, () => {
    measureOverflow();
    placeMark();
  }, { flush: "post" });
  const canScrollStart = computed((): boolean => overflows.value && !arrivedState.left);
  const canScrollEnd = computed((): boolean => overflows.value && !arrivedState.right);

  const reducedMotion = computed((): boolean => usePreferredReducedMotion().value === "reduce");

  /**
   * The width of a faded edge (and of an arrow), in px.
   */
  const EDGE = 40;

  /**
   * Scrolls the row to a position, eased (`ROW_SCROLL_DURATION`, in ms; the
   * browsers' own smooth scrolling of an element may be cut short, or
   * skipped, while the page scrolls), at once with reduced motion. A new
   * position, or the user scrolling the row, takes over.
   */
  const ROW_SCROLL_DURATION = 300;
  let rowAnimation = 0;
  const stopRowScroll = (): void => {
    cancelAnimationFrame(rowAnimation);
  };
  function scrollRowTo(left: number): void {
    const element = row.value;
    if (!element) return;
    stopRowScroll();
    const to = Math.min(Math.max(left, 0), element.scrollWidth - element.clientWidth);
    if (reducedMotion.value) {
      element.scrollLeft = to;
      return;
    }
    const from = element.scrollLeft;
    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min((now - start) / ROW_SCROLL_DURATION, 1);
      element.scrollLeft = from + (to - from) * (1 - (1 - progress) ** 3);
      if (progress < 1) rowAnimation = requestAnimationFrame(step);
    };
    rowAnimation = requestAnimationFrame(step);
  }
  onBeforeUnmount(stopRowScroll);

  const scrollRowBy = (direction: 1 | -1): void => {
    if (row.value) scrollRowTo(row.value.scrollLeft + direction * row.value.clientWidth * 0.75);
  };

  /**
   * The mark under the group being read: one line in the row that slides
   * from link to link (`translate`, `width`), in the group's color; placed at
   * once when it appears (`markSlides`), and without sliding with reduced
   * motion.
   */
  const mark = ref<{ left: number; width: number; color?: ColorKey }>();
  const markSlides = ref(false);
  function placeMark(): void {
    const group = props.groups.find(({ key }) => key === current.value);
    const link = group && row.value?.querySelector<HTMLElement>(`[data-group="${group.key}"]`);
    if (!group || !link) {
      mark.value = undefined;
      markSlides.value = false;
      return;
    }
    const appears = !mark.value;
    // As the links' inner margins (`inset-x-3`).
    mark.value = { left: link.offsetLeft + 12, width: link.offsetWidth - 24, color: group.color };
    if (appears) requestAnimationFrame(() => (markSlides.value = true));
  }
  watch(current, placeMark, { flush: "post" });

  /**
   * The group being read stays in sight in the row (not with reduced motion:
   * the row then never moves by itself).
   */
  watch(current, (key) => {
    if (reducedMotion.value) return;
    const element = row.value;
    const link = key && element?.querySelector<HTMLElement>(`[data-group="${key}"]`);
    if (!element || !link) return;
    const margin = overflows.value ? EDGE : 0;
    const start = link.offsetLeft - margin;
    const end = link.offsetLeft + link.offsetWidth + margin - element.clientWidth;
    if (element.scrollLeft > start) scrollRowTo(start);
    else if (element.scrollLeft < end) scrollRowTo(end);
  });
</script>

<template>
  <!--
    The table of contents: a link per group, in its colors, to its card. The
    active tag's and the favorites' (always active) solid: the tag's text
    color as background, its palest shade as text (readable both ways, in
    both themes); the group being read underlined (`aria-current`).

    Sticky under the header (whose bottom moves on small screens, cf.
    `--header-bottom`), on a single row of constant height (`--toc-height`,
    cf. `signets.vue`) that scrolls sideways (to the edges of the screen
    below `md`), by a horizontal swipe or wheel only (a vertical one scrolls
    the page, even over the row); its edges fade where it overflows, with
    arrows for a fine pointer (a touch screen swipes), both fading in and
    out. Once stuck, the header's background and border, across the pages'
    scroller (a pseudo-element, `100cqw` wide: as wide as it, cf.
    `PageScroller`; no ancestor clips it, which made it flicker in Safari,
    in the scroller).
  -->
  <nav
    ref="nav"
    :aria-label="label"
    class="sticky top-(--header-bottom) z-10 col-span-full before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-[100cqw] before:-translate-x-1/2 before:border-b before:transition-colors before:duration-300 motion-reduce:before:transition-none"
    :class="stuck ? 'before:border-default before:bg-bar' : 'before:border-transparent'"
  >
    <ul
      ref="row"
      class="relative flex gap-2 overflow-x-auto py-2 [scrollbar-width:none] max-md:-mx-4 max-md:px-4 md:-mx-1 md:px-1"
      @wheel.passive="stopRowScroll"
      @pointerdown="stopRowScroll"
      @touchstart.passive="stopRowScroll"
    >
      <li
        v-for="group in groups"
        :key="group.key"
        :data-tag-color="group.color"
        class="shrink-0"
      >
        <!-- Named « Homère, 12 entrées » (the full name, the count spelled out). -->
        <NuxtLink
          :to="{ query: route.query, hash: `#${group.id}` }"
          :data-group="group.key"
          :aria-label="group.count === undefined ? undefined : `${group.name}, ${group.count} ${entryCount(group.count)}${group.active && group.key !== 'favorites' ? ', étiquette active' : ''}`"
          :aria-current="group.key === current ? 'location' : undefined"
          class="relative flex h-8 items-center gap-1.5 rounded-full pe-3 text-sm ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tag-400"
          :class="[!group.color
            ? 'bg-default text-default ring ring-default hover:bg-elevated focus-visible:outline-(--ui-border-inverted)'
            : group.active
              ? 'bg-tag-text text-tag-100 hover:bg-tag-text/90'
              : 'bg-tag-100 text-tag-text ring ring-tag-300/60 hover:bg-tag-200/80', group.icon ? 'ps-2.5' : 'ps-3', { 'font-serif': group.serif }]"
          @click="follow(group)"
        >
          <UIcon
            v-if="group.icon"
            :name="group.icon"
            class="size-4 shrink-0"
          />
          <span class="max-w-48 truncate font-medium">{{ group.name }}</span>
          <span
            v-if="group.count !== undefined"
            class="tabular-nums opacity-75"
          >{{ group.count }}</span>
        </NuxtLink>
      </li>

      <!-- The mark under the group being read (cf. `placeMark`). -->
      <li
        v-if="mark"
        aria-hidden="true"
        data-toc-mark
        :data-tag-color="mark.color"
        class="pointer-events-none absolute start-0 bottom-0.5 h-0.5 rounded-full duration-300 ease-out motion-reduce:transition-none"
        :class="[mark.color ? 'bg-tag-text' : 'bg-(--ui-text)', { 'transition-[translate,width,background-color]': markSlides }]"
        :style="{ translate: `${mark.left}px 0`, width: `${mark.width}px` }"
      />
    </ul>

    <!--
      The faded edges, over the row, as wide as it (to the edges of the screen
      below `md`): the page's background fading out. (Not a mask on the row:
      in the pages' scroller, Safari (macOS) made the row flicker with it.)
    -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 start-0 bg-linear-to-r from-(--app-page-bg) to-transparent transition-opacity duration-200 ease-out max-md:-start-4 md:-start-1"
      :class="canScrollStart ? 'opacity-100' : 'opacity-0'"
      :style="{ width: `${EDGE}px` }"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 end-0 bg-linear-to-l from-(--app-page-bg) to-transparent transition-opacity duration-200 ease-out max-md:-end-4 md:-end-1"
      :class="canScrollEnd ? 'opacity-100' : 'opacity-0'"
      :style="{ width: `${EDGE}px` }"
    />

    <!-- Arrows: a pointer's affordance (the keyboard goes from link to link). -->
    <UButton
      icon="i-lucide-chevron-left"
      size="sm"
      color="neutral"
      variant="outline"
      tabindex="-1"
      aria-hidden="true"
      class="absolute start-0 top-1/2 hidden -translate-y-1/2 bg-default transition-[opacity,visibility] duration-200 ease-out pointer-fine:flex max-md:-start-2"
      :class="canScrollStart ? 'visible opacity-100' : 'invisible opacity-0'"
      @click="scrollRowBy(-1)"
    />
    <UButton
      icon="i-lucide-chevron-right"
      size="sm"
      color="neutral"
      variant="outline"
      tabindex="-1"
      aria-hidden="true"
      class="absolute end-0 top-1/2 hidden -translate-y-1/2 bg-default transition-[opacity,visibility] duration-200 ease-out pointer-fine:flex max-md:-end-2"
      :class="canScrollEnd ? 'visible opacity-100' : 'invisible opacity-0'"
      @click="scrollRowBy(1)"
    />
  </nav>
</template>
