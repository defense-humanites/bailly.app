/**
 * How long, at most, to wait for the end of a smooth scroll where `scrollend`
 * is not supported.
 */
const SCROLL_WAIT = 1500;

/**
 * Calls back once the page's scroll just started (smooth, e.g. by a link to
 * an anchor, cf. `router.options.ts`) is over: at its end (`scrollend`, or
 * at the latest after `SCROLL_WAIT` ms where it is not supported), or at
 * once if the page doesn't scroll (its target already in place).
 */
export function afterScroll(callback: () => void): void {
  let scrolling = false;
  let done = false;
  const onScroll = (): void => {
    scrolling = true;
  };
  const run = (): void => {
    if (done) return;
    done = true;
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("scrollend", run);
    clearTimeout(timeout);
    callback();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scrollend", run);
  const timeout = setTimeout(run, SCROLL_WAIT);
  setTimeout(() => {
    if (!scrolling) run();
  }, 150);
}

/**
 * Points a bookmarks' card out, once the page has scrolled to it (from the
 * table of contents, or pinning it): outlined for a moment
 * (`[data-card-highlight]`, cf. `components.css`), started again if it
 * already is.
 */
export function highlightCard(card: HTMLElement): void {
  afterScroll(() => {
    card.removeAttribute("data-card-highlight");
    // Restarts the animation (a reflow between removing and setting).
    card.getBoundingClientRect();
    card.setAttribute("data-card-highlight", "");
    const end = (event: AnimationEvent): void => {
      if (event.target !== card) return;
      card.removeAttribute("data-card-highlight");
      card.removeEventListener("animationend", end);
    };
    card.addEventListener("animationend", end);
  });
}
