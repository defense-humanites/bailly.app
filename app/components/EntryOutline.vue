<script setup lang="ts">
  import type { OutlineItem } from "~/utils/sensePath";

  const props = defineProps<{
    /** The entry's outline (cf. `entryOutline`). */
    items: OutlineItem[];
    /** The sense being read (cf. `senseAt`), or none. */
    current: Element | null;
    /**
     * Whether the third level (« 1. » under « A. › I. ») only shows in the
     * section being read, so that a long entry's outline fits a column.
     */
    collapse?: boolean;
  }>();

  // Greek may be transliterated (a preference): the homonyms' headwords.
  const greek = useGreek();

  const emit = defineEmits<{
    /** An item chosen, to bring its sense (or homonym) into view. */
    select: [item: OutlineItem];
  }>();

  /** The index of the item being read, and those of the items holding it. */
  const currentIndex = computed(() => props.items.findIndex(item => item.element === props.current));
  const chain = computed(() => {
    const indexes = new Set<number>();
    for (let index = currentIndex.value; index >= 0; index = props.items[index]!.parent) indexes.add(index);
    return indexes;
  });

  /** The level of an item among the senses (a homonym's above them). */
  const senseDepth = (item: OutlineItem): number => (item.sense && props.items[0]?.sense === false ? item.depth - 1 : item.depth);

  const shown = computed(() => props.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !props.collapse || senseDepth(item) < 2 || chain.value.has(item.parent)));

  /** The indents of the levels (homonym, part, section, sense). */
  const INDENTS = ["ps-2.5", "ps-5", "ps-7.5", "ps-10"];

  /*
   * The item being read kept in sight in the outline's own scroller (the
   * column, the popover; never by scrolling the page), as the group being
   * read in the bookmarks' row (`BookmarksToc`): when it changes, the
   * outline scrolls as little as needed, eased, a margin of 40 px around it
   * (not with reduced motion: the outline then never moves by itself); when
   * the outline appears, at once, the item centered.
   */
  const list = useTemplateRef<HTMLElement>("list");
  const scroller = shallowRef<HTMLElement | null>(null);
  const { scrollTo, reducedMotion } = useEasedScroll(scroller, "top");
  const MARGIN = 40;

  const reveal = (appearing: boolean): void => {
    const button = list.value?.querySelector<HTMLElement>("[aria-current]");
    let box = list.value?.parentElement ?? null;
    while (box && box.tagName !== "MAIN" && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    scroller.value = box && box.tagName !== "MAIN" ? box : null;
    if (!button || !scroller.value) return;
    const element = scroller.value;
    const top = button.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop;
    if (appearing) {
      element.scrollTop = top - (element.clientHeight - button.offsetHeight) / 2;
      return;
    }
    if (reducedMotion.value) return;
    const start = top - MARGIN;
    const end = top + button.offsetHeight + MARGIN - element.clientHeight;
    if (element.scrollTop > start) scrollTo(start);
    else if (element.scrollTop < end) scrollTo(end);
  };
  onMounted(async () => {
    await nextTick();
    reveal(true);
  });
  watch(currentIndex, async () => {
    await nextTick();
    reveal(false);
  });
</script>

<!--
  The outline of a long entry: its parts, sections and senses, by their
  numbers (in bold) and labels (as the compact bar's path), indented by
  level; the one being read marked, as the headwords of an ambiguous form's
  page (`forme/[[forme]].vue`), and the ones holding it in the text's color.
  In neutral colors, as that page's column: the numbers in their line's,
  not in the primary color of the text's (a column of them would draw the
  eye from the text).
-->
<template>
  <nav aria-label="Sommaire de l'entrée">
    <ul
      ref="list"
      class="space-y-0.5"
    >
      <li
        v-for="{ item, index } in shown"
        :key="index"
      >
        <button
          type="button"
          :aria-current="index === currentIndex ? 'location' : undefined"
          class="flex w-full min-w-0 items-baseline gap-1.5 rounded-md py-1 pe-2.5 text-start font-serif text-sm transition-colors focus-visible:outline-2 focus-visible:outline-(--ui-border-inverted)"
          :class="[
            INDENTS[item.depth] ?? INDENTS.at(-1),
            index === currentIndex ? 'bg-accented/50 text-highlighted' : chain.has(index) ? 'text-highlighted hover:bg-accented/50' : 'text-muted hover:bg-accented/50 hover:text-highlighted',
          ]"
          @click="emit('select', item)"
        >
          <span
            v-if="item.number"
            class="shrink-0 font-bold"
          >{{ item.number }}</span>
          <span
            class="truncate"
            :class="{ 'font-bold': !item.sense }"
            :lang="item.sense ? undefined : greek.lang.value"
          >{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
