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
  // The pages' scroller (cf. `usePageScroller`).
  const scroller = document.getElementById("page") ?? window;
  let scrolling = false;
  let done = false;
  const onScroll = (): void => {
    scrolling = true;
  };
  const run = (): void => {
    if (done) return;
    done = true;
    scroller.removeEventListener("scroll", onScroll);
    scroller.removeEventListener("scrollend", run);
    clearTimeout(timeout);
    callback();
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  scroller.addEventListener("scrollend", run);
  const timeout = setTimeout(run, SCROLL_WAIT);
  setTimeout(() => {
    if (!scrolling) run();
  }, 150);
}

/**
 * Points an element out: outlined for a moment (`[data-card-highlight]`, cf.
 * `components.css`, in `--card-highlight`), started again if it already is.
 */
export function pointOut(element: HTMLElement): void {
  element.removeAttribute("data-card-highlight");
  // Restarts the animation (a reflow between removing and setting).
  element.getBoundingClientRect();
  element.setAttribute("data-card-highlight", "");
  const end = (event: AnimationEvent): void => {
    if (event.target !== element) return;
    element.removeAttribute("data-card-highlight");
    element.removeEventListener("animationend", end);
  };
  element.addEventListener("animationend", end);
}

/**
 * Points a bookmarks' card out (`pointOut`), once the page has scrolled to it
 * (from the table of contents, or pinning it).
 */
export function highlightCard(card: HTMLElement): void {
  afterScroll(() => {
    pointOut(card);
  });
}

/**
 * Calls back once an element is in view: at once if it is, or once the
 * page has scrolled to it (smoothly, unless reduced motion is preferred),
 * e.g. a menu's button out of view (on a phone, the bookmarks' bar, from
 * the guide below), its menu then opened by it, not off the screen.
 */
export function revealThen(element: HTMLElement, callback: () => void): void {
  const scroller = document.getElementById("page");
  const box = element.getBoundingClientRect();
  const view = scroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
  if (box.top >= view.top && box.bottom <= view.bottom) {
    callback();
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" });
  afterScroll(callback);
}
