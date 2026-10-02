<script setup lang="ts">
  import type { ColorKey } from "~/enums";

  /**
   * A group of the bookmarks page, as listed in its table of contents.
   */
  export interface TocGroup {
    key: string;
    /** The id of the group's card (the link's target). */
    id: string;
    name: string;
    color: ColorKey;
    icon: string;
    /** Its number of entries. */
    count: number;
    /** Whether it is the active tag (the favorites always are). */
    active: boolean;
  }

  const props = defineProps<{
    groups: TocGroup[];
  }>();

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
   * bottom can't reach the table of contents).
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
    stuck.value = window.scrollY > 0 && box.top <= Number.parseFloat(getComputedStyle(nav.value).top) + 0.5;
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
    current.value = read?.key;
  }

  const { y } = useWindowScroll();
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

  const follow = (key: string): void => {
    followed = current.value = key;
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
  useResizeObserver(row, measureOverflow);
  watch(() => props.groups, measureOverflow, { flush: "post" });
  const canScrollStart = computed((): boolean => overflows.value && !arrivedState.left);
  const canScrollEnd = computed((): boolean => overflows.value && !arrivedState.right);

  const reducedMotion = usePreferredReducedMotion();
  const behavior = computed((): ScrollBehavior => (reducedMotion.value === "reduce" ? "auto" : "smooth"));

  /**
   * The width of a faded edge (and of an arrow), in px.
   */
  const EDGE = 40;

  const scrollRowBy = (direction: 1 | -1): void => {
    row.value?.scrollBy({ left: direction * row.value.clientWidth * 0.75, behavior: behavior.value });
  };

  /**
   * A vertical wheel scrolls the row sideways, as long as it can go that way
   * (then the page scrolls).
   */
  function onWheel(event: WheelEvent): void {
    const element = row.value;
    if (!element || !overflows.value || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const max = element.scrollWidth - element.clientWidth;
    if ((event.deltaY < 0 && element.scrollLeft > 0) || (event.deltaY > 0 && element.scrollLeft < max - 1)) {
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    }
  }

  /**
   * The group being read stays in sight in the row.
   */
  watch(current, (key) => {
    const element = row.value;
    const link = key && element?.querySelector<HTMLElement>(`[data-group="${key}"]`);
    if (!element || !link) return;
    const margin = overflows.value ? EDGE : 0;
    const start = link.offsetLeft - margin;
    const end = link.offsetLeft + link.offsetWidth + margin - element.clientWidth;
    if (element.scrollLeft > start) element.scrollTo({ left: start, behavior: behavior.value });
    else if (element.scrollLeft < end) element.scrollTo({ left: end, behavior: behavior.value });
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
    cf. `signets.vue`) that scrolls sideways: to the edges of the screen
    below `md`; from `md`, its edges fade where it overflows, with arrows
    (fine pointer). Once stuck, the header's background and border, across
    the whole window (a pseudo-element; the page clips it sideways).
  -->
  <nav
    ref="nav"
    aria-label="Sommaire des signets"
    class="sticky top-(--header-bottom) z-10 col-span-full transition-[top] duration-300 ease-out before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:border-b before:transition-colors before:duration-300 motion-reduce:transition-none md:transition-none"
    :class="stuck ? 'before:border-default before:bg-bar before:backdrop-blur-sm' : 'before:border-transparent'"
  >
    <ul
      ref="row"
      class="relative flex gap-2 overflow-x-auto py-2 [scrollbar-width:none] max-md:-mx-4 max-md:px-4 md:-mx-1 md:px-1"
      :style="{
        '--fade-start': canScrollStart ? `${EDGE}px` : '0px',
        '--fade-end': canScrollEnd ? `${EDGE}px` : '0px',
      }"
      :class="'md:[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-start),#000_calc(100%-var(--fade-end)),transparent)]'"
      @wheel="onWheel"
    >
      <li
        v-for="group in groups"
        :key="group.key"
        :data-tag-color="group.color"
        class="shrink-0"
      >
        <!-- Named « Homère, 12 entrées » (the full name, the count spelled out). -->
        <NuxtLink
          :to="{ hash: `#${group.id}` }"
          :data-group="group.key"
          :aria-label="`${group.name}, ${group.count} ${entryCount(group.count)}${group.active && group.key !== 'favorites' ? ', étiquette active' : ''}`"
          :aria-current="group.key === current ? 'location' : undefined"
          class="relative flex h-8 items-center gap-1.5 rounded-full ps-2.5 pe-3 text-sm ring-inset transition-colors after:absolute after:inset-x-3 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-tag-text after:opacity-0 after:transition-opacity aria-[current]:after:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tag-400"
          :class="group.active
            ? 'bg-tag-text text-tag-100 hover:bg-tag-text/90'
            : 'bg-tag-100 text-tag-text ring ring-tag-300/60 hover:bg-tag-200/80'"
          @click="follow(group.key)"
        >
          <UIcon
            :name="group.icon"
            class="size-4 shrink-0"
          />
          <span class="max-w-48 truncate font-medium">{{ group.name }}</span>
          <span class="tabular-nums opacity-75">{{ group.count }}</span>
        </NuxtLink>
      </li>
    </ul>

    <!-- Arrows: a pointer's affordance (the keyboard goes from link to link). -->
    <UButton
      v-show="canScrollStart"
      icon="i-lucide-chevron-left"
      size="sm"
      color="neutral"
      variant="outline"
      tabindex="-1"
      aria-hidden="true"
      class="absolute start-0 top-1/2 hidden -translate-y-1/2 bg-default pointer-fine:md:flex"
      @click="scrollRowBy(-1)"
    />
    <UButton
      v-show="canScrollEnd"
      icon="i-lucide-chevron-right"
      size="sm"
      color="neutral"
      variant="outline"
      tabindex="-1"
      aria-hidden="true"
      class="absolute end-0 top-1/2 hidden -translate-y-1/2 bg-default pointer-fine:md:flex"
      @click="scrollRowBy(1)"
    />
  </nav>
</template>
