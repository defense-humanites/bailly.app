import type { Ref } from "vue";

/**
 * The duration of an eased scroll, in ms.
 */
const DURATION = 300;

/**
 * Scrolls an element of its own (the bookmarks' row of groups, an entry's
 * outline) to a position, eased (an ease-out of `DURATION`: the browsers' own
 * smooth scrolling of an element may be cut short, or skipped, while the
 * page scrolls), at once with reduced motion. A new position, or `stop`
 * (e.g. the user scrolling it), takes over; stopped when unmounted.
 * @param axis The scroll's axis: `left` (a row), `top` (a column).
 */
export function useEasedScroll(target: Readonly<Ref<HTMLElement | null | undefined>>, axis: "left" | "top") {
  const preference = usePreferredReducedMotion();
  const reducedMotion = computed((): boolean => preference.value === "reduce");
  const property = axis === "left" ? "scrollLeft" : "scrollTop";

  let frame = 0;
  const stop = (): void => {
    cancelAnimationFrame(frame);
  };

  const scrollTo = (position: number): void => {
    const element = target.value;
    if (!element) return;
    stop();
    const range = axis === "left" ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
    const to = Math.min(Math.max(position, 0), range);
    if (reducedMotion.value) {
      element[property] = to;
      return;
    }
    const from = element[property];
    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min((now - start) / DURATION, 1);
      element[property] = from + (to - from) * (1 - (1 - progress) ** 3);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  onBeforeUnmount(stop);

  return { scrollTo, stop, reducedMotion };
}
