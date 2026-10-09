import type { MaybeRefOrGetter, Ref } from "vue";

/**
 * The section in view, for a column of links to a page's sections (the
 * ambiguous forms' headwords, the privacy page's subjects): the last one
 * whose top has passed a "reading line" (a quarter of the window, lower
 * than where a link brings a section: its scroll margin), the first one at
 * the page's top, or the last one at the bottom of a page that scrolled.
 * A section reached by a link (`follow`) is the one marked (it may not reach
 * the reading line, e.g. near the page's bottom, or all of them in view),
 * until the user scrolls by themselves; so is the one a page is opened at
 * (`#id`).
 *
 * With `anchors`, the sections are the page's anchors (the privacy page's
 * subjects): none is marked before the first reaches the reading line (at
 * the page's top, above them, its summary), and the address follows the
 * one marked (`#id`, none above them), replaced rather than added to the
 * history, the page not scrolled.
 * @param ids The sections' elements' ids, in their order.
 * @param options.anchors Whether the sections are the page's anchors.
 */
export function useCurrentSection(ids: MaybeRefOrGetter<string[]>, { anchors = false }: { anchors?: boolean } = {}): {
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
    let current: HTMLElement | undefined = anchors ? undefined : elements[0];
    for (const element of elements) {
      if (element.getBoundingClientRect().top <= readingLine) current = element;
    }
    // At the page's top, the first one (all the sections may be in view),
    // or none (anchors).
    if (!box?.scrollTop) current = anchors ? undefined : elements[0];
    currentId.value = atBottom ? elements.at(-1)!.id : current?.id;
  };

  // The address following the section marked (anchors): replaced, with the
  // router's record of it (`current`, for the way back), the page not
  // scrolled (`router.replace` would scroll to it).
  if (anchors) {
    watch(currentId, (id) => {
      const hash = id ? `#${id}` : "";
      if (location.hash === hash) return;
      const url = `${location.pathname}${location.search}${hash}`;
      history.replaceState({ ...(history.state as Record<string, unknown> | null), current: url }, "", url);
    });
  }

  watch(y, () => requestAnimationFrame(update));
  // The scroller is set once the layout is mounted, after the page.
  watch(scroller, update);

  const release = (): void => {
    if (!followed) return;
    followed = undefined;
    update();
  };
  useUserScroll(() => {
    release();
  });

  /**
   * Marks a section reached by a link.
   */
  const follow = (id: string): void => {
    followed = currentId.value = id;
  };

  onMounted(() => {
    let hash = "";
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      // A malformed hash: no section.
    }
    if (toValue(ids).includes(hash)) follow(hash);
    else update();
  });

  return { currentId, follow };
}
