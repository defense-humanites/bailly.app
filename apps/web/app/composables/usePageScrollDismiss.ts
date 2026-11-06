/** The page's scroll closing a panel past this distance (a touchpad's brush tolerated). */
const SCROLL_CLOSE_DISTANCE = 12;
/** Within this delay of its opening, a scroll not the reader's is the panel's own. */
const OPENING = 400;
/** Within this delay of its field being focused, the page brought to the field. */
const FIELD_FOCUS = 1000;

/**
 * A panel opening over the page (the tags' panel, the bookmarks' active tag's
 * list) closed as soon as the page scrolls, as a system's menu: it doesn't
 * follow its button under the header. By more than `SCROLL_CLOSE_DISTANCE`.
 * The panel's own list scrolls in its element: not the page's scroll.
 *
 * Two scrolls of the page are not the reader's:
 * - within `OPENING` of the panel's opening (`opened`), without a wheel nor
 *   a touch of the reader's, the page brought by the panel itself (Reka's
 *   lists bringing their highlighted item into view, `scrollIntoView`, all
 *   the scrollers above them too: Safari did it before the panel was placed,
 *   at the scroller's top): undone at once, before it is painted;
 * - within `FIELD_FOCUS` of its field being focused (`fieldFocused`), the
 *   page brought to the field by iOS Safari, as its keyboard shows: kept,
 *   not closing it.
 * @param open Whether the panel is open (set to `false` to close it).
 * @returns `opened`, to call once the panel opens (after the page scrolled
 * for it, if it did); `fieldFocused`, as its field is focused; and
 * `closedByScroll`, true once (read, it is reset) if the panel was closed
 * by a scroll: its button, focused back, without scrolling the page to it.
 */
export function usePageScrollDismiss(open: Ref<boolean>): {
  opened: () => void;
  fieldFocused: () => void;
  closedByScroll: () => boolean;
} {
  const pageScroller = usePageScroller();
  let openedAt = 0;
  let readerScrolledAt = -Infinity;
  let fieldFocusedAt = -Infinity;
  let scrollFrom = 0;
  let closed = false;

  const readerScrolls = (): void => {
    readerScrolledAt = performance.now();
  };
  useEventListener(pageScroller, ["wheel", "touchmove"], readerScrolls, { passive: true });
  useEventListener(pageScroller, "scroll", () => {
    const scroller = pageScroller.value;
    if (!open.value || !scroller) return;
    const now = performance.now();
    if (now - openedAt < OPENING && readerScrolledAt < openedAt) scroller.scrollTop = scrollFrom;
    else if (now - fieldFocusedAt < FIELD_FOCUS) scrollFrom = scroller.scrollTop;
    else if (Math.abs(scroller.scrollTop - scrollFrom) > SCROLL_CLOSE_DISTANCE) {
      closed = true;
      open.value = false;
    }
  }, { passive: true });

  return {
    opened: () => {
      openedAt = performance.now();
      scrollFrom = pageScroller.value?.scrollTop ?? 0;
    },
    fieldFocused: () => {
      fieldFocusedAt = performance.now();
    },
    closedByScroll: () => {
      const was = closed;
      closed = false;
      return was;
    },
  };
}
