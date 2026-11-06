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

/**
 * The scroll positions held, by scroller (cf. `holdPageScroll`).
 */
const held = new WeakMap<HTMLElement, number>();

/**
 * Holds the page where it is for `duration` ms: its scrolls meanwhile are
 * undone (as they happen, before they are painted), unless the reader's own
 * (a wheel, a touch, a key). Called again meanwhile, the page stays held at
 * the first position (e.g. a tag's edit mode ending as another's begins).
 * @remarks For a change of the page that must not move it, but after which
 * the browser scrolls it by itself (cf. `BookmarkGroup`'s edit mode).
 */
export function holdPageScroll(scroller: HTMLElement, duration = 300): void {
  if (held.has(scroller)) return;
  const top = scroller.scrollTop;
  held.set(scroller, top);
  const restore = (): void => {
    if (scroller.scrollTop !== top) scroller.scrollTop = top;
  };
  const release = (): void => {
    clearTimeout(timer);
    held.delete(scroller);
    scroller.removeEventListener("scroll", restore);
    for (const type of ["wheel", "touchmove", "keydown"]) window.removeEventListener(type, release, true);
  };
  const timer = setTimeout(release, duration);
  scroller.addEventListener("scroll", restore, { passive: true });
  for (const type of ["wheel", "touchmove", "keydown"]) window.addEventListener(type, release, { capture: true, passive: true });
}
