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

  /*
   * Hovered with a mouse, or focused from the keyboard, an item tints its
   * sense in the text (`[data-outline-preview]`, cf. `components.css`):
   * where it leads, before it is chosen. Not from a touch (it would stay
   * tinted), nor once chosen (pointed out then, cf. `goToSense`). One sense
   * singled out at a time: another one chosen just before (outlined) fades
   * at once.
   */
  let previewed: Element | null = null;
  const preview = (item: OutlineItem | null): void => {
    previewed?.removeAttribute("data-outline-preview");
    previewed = item?.element ?? null;
    if (!previewed) return;
    for (const chosen of document.querySelectorAll(".definition [data-card-highlight]")) {
      if (chosen !== previewed) hastenPointOut(chosen);
    }
    previewed.setAttribute("data-outline-preview", "");
  };
  // On a move of the mouse, not on its entering an item: the outline
  // scrolls by itself (cf. `reveal`), and an item slid under a still cursor
  // would be previewed (the sense just chosen then not pointed out).
  // (Some browsers send a move then, the cursor in place: compared with the
  // last one, anywhere, recorded once the items have seen it.)
  const pointer = { x: Number.NaN, y: Number.NaN };
  useEventListener(
    window,
    "pointermove",
    (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    },
    { passive: true },
  );
  // Nor the item just chosen, until the cursor has left it.
  let chosen: Element | null = null;
  const onPointerMove = (event: PointerEvent, item: OutlineItem): void => {
    if (event.pointerType !== "mouse" || (event.clientX === pointer.x && event.clientY === pointer.y)) return;
    if (previewed !== item.element && chosen !== item.element) preview(item);
  };
  const onPointerLeave = (item: OutlineItem): void => {
    if (chosen === item.element) chosen = null;
    preview(null);
  };
  const onFocus = (event: FocusEvent, item: OutlineItem): void => {
    if (event.target instanceof Element && event.target.matches(":focus-visible")) preview(item);
  };
  const choose = (item: OutlineItem): void => {
    preview(null);
    chosen = item.element;
    emit("select", item);
  };
  onBeforeUnmount(() => {
    preview(null);
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
   * outline scrolls as little as needed, eased, a margin of 40 px around it,
   * and back to its start when no sense is being read (the page's top); not
   * with reduced motion, the outline then never moving by itself. When the
   * outline appears, at once, the item centered.
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
    if (!scroller.value) return;
    const element = scroller.value;
    // No sense being read (the page's top, a definition's head): the
    // outline back at its start.
    if (!button) {
      if (!appearing && !reducedMotion.value) scrollTo(0);
      return;
    }
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
  <nav
    aria-label="Sommaire de l'entrée"
    data-outline
  >
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
          @click="choose(item)"
          @pointermove="onPointerMove($event, item)"
          @pointerleave="onPointerLeave(item)"
          @focus="onFocus($event, item)"
          @blur="preview(null)"
        >
          <UIcon
            v-if="item.arrow"
            name="i-bailly-arrow"
            class="h-[0.6em] w-[1.65em] shrink-0"
          />
          <span
            v-else-if="item.number"
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
