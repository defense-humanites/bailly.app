/**
 * The scroll positions of the pages, by history entry (vue-router's
 * `history.state.position`): the window no longer scrolls (cf.
 * `usePageScroller`), so that the router's own saved positions are always
 * at the top. Kept as the page scrolls; read going back or forward.
 */
const positions = new Map<number, number>();

const historyPosition = (): number | undefined => {
  const position = (window.history.state as { position?: unknown } | null)?.position;
  return typeof position === "number" ? position : undefined;
};

/**
 * Keeps the scroll positions of the page scroller, for the current history
 * entry.
 * @returns A function that stops it.
 */
export function rememberPageScroll(scroller: HTMLElement): () => void {
  const onScroll = (): void => {
    const position = historyPosition();
    if (position !== undefined) positions.set(position, scroller.scrollTop);
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    scroller.removeEventListener("scroll", onScroll);
  };
}

/**
 * The scroll position kept for the current history entry, if any.
 */
export function savedPageScroll(): number | undefined {
  const position = historyPosition();
  return position === undefined ? undefined : positions.get(position);
}
