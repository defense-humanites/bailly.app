import type { MaybeRefOrGetter, Ref } from "vue";

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/**
 * The section in view, for a column of links to a page's sections (the
 * ambiguous forms' headwords, the privacy page's subjects): the last one
 * whose top has passed a "reading line" (a quarter of the window, lower
 * than where a link brings a section: its scroll margin), the first one at
 * the page's top, or the last one at the bottom of a page that scrolled.
 * A section reached by a link (`follow`) is the one marked (it may not reach
 * the reading line, e.g. near the page's bottom, or all of them in view),
 * until the user scrolls by themselves.
 * @param ids The sections' elements' ids, in their order.
 */
export function useCurrentSection(ids: MaybeRefOrGetter<string[]>): {
  currentId: Ref<string | undefined>;
  follow: (id: string) => void;
} {
  const currentId = ref<string>();
  const scroller = usePageScroller();
  const { y } = usePageScroll();
  let followed: string | undefined;

  const update = (): void => {
    if (followed) {
      currentId.value = followed;
      return;
    }
    const elements = toValue(ids)
      .map(id => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (!elements.length) return;

    const box = scroller.value;
    // At the bottom of a page that scrolled (all the sections may fit).
    const atBottom = box ? box.scrollTop > 0 && box.clientHeight + box.scrollTop >= box.scrollHeight - 2 : false;
    // The reading line, lower than where a link brings its section (its
    // scroll margin), on a short window too.
    const margin = Number.parseFloat(getComputedStyle(elements[0]!).scrollMarginTop) || 0;
    const readingLine = Math.max(window.innerHeight / 4, (box?.getBoundingClientRect().top ?? 0) + margin + 1);
    let current = elements[0]!;
    for (const element of elements) {
      if (element.getBoundingClientRect().top <= readingLine) current = element;
    }
    // At the page's top, the first one (all the sections may be in view).
    if (!box?.scrollTop) current = elements[0]!;
    currentId.value = atBottom ? elements.at(-1)!.id : current.id;
  };

  onMounted(update);
  watch(y, () => requestAnimationFrame(update));

  const release = (): void => {
    if (!followed) return;
    followed = undefined;
    update();
  };
  useEventListener("wheel", release, { passive: true });
  useEventListener("touchmove", release, { passive: true });
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) release();
  });

  /**
   * Marks a section reached by a link.
   */
  const follow = (id: string): void => {
    followed = currentId.value = id;
  };

  return { currentId, follow };
}
