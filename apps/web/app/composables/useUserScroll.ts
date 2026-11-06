/**
 * The keys that scroll a page.
 */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/**
 * Calls back when the user scrolls by themselves (a wheel, a swipe, a
 * scrolling key), not when the page is scrolled for them (e.g. brought to a
 * section): what a link pointed out stops deciding then.
 * @param callback Given the event (e.g. to ignore a scroll within a panel).
 */
export function useUserScroll(callback: (event: Event) => void): void {
  useEventListener("wheel", callback, { passive: true });
  useEventListener("touchmove", callback, { passive: true });
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) callback(event);
  });
}
