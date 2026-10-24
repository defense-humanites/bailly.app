import type { EffectScope, ShallowRef } from "vue";

/**
 * The element that scrolls the pages: the layout's `main`, under the fixed
 * header (cf. `layouts/default.vue`). The window never scrolls, as on the
 * former application: on iOS, the keyboard opening for the search bar
 * scrolled it, the header disappearing meanwhile; on Android, the focus
 * brought the browser's bars back.
 * @remarks Set by the layout once mounted (after the pages, mounted first):
 * the scroll listeners attach then.
 */
const scroller = shallowRef<HTMLElement | null>(null);

export const usePageScroller = (): ShallowRef<HTMLElement | null> => scroller;

/** The pages' vertical scroll, shared by `usePageScroll`'s callers. */
const y = shallowRef(0);
let scope: EffectScope | undefined;

/**
 * The pages' vertical scroll (cf. `usePageScroller`), as `useWindowScroll`
 * would give the window's: one passive listener on the scroller, shared,
 * reading its `scrollTop` on each scroll event and, when the scroller comes
 * (the layout mounted), at the next frame.
 * @remarks Rather than VueUse's `useScroll` (one per caller), which on
 * mounting and on every scroll event also measured the arrived state with
 * the scroller's computed style: on mounting, a forced style and layout
 * computation in the hydration's task (about 80 ms with the CPU slowed down
 * 4 times, cf. `audit-inp.md`), for a state no caller used.
 */
export const usePageScroll = (): { y: Readonly<ShallowRef<number>> } => {
  if (import.meta.client && !scope) {
    scope = effectScope(true);
    scope.run(() => {
      watch(scroller, (element, _, onCleanup) => {
        if (!element) return;
        const read = (): void => {
          y.value = element.scrollTop;
        };
        element.addEventListener("scroll", read, { passive: true });
        const frame = requestAnimationFrame(read);
        onCleanup(() => {
          element.removeEventListener("scroll", read);
          cancelAnimationFrame(frame);
        });
      }, { immediate: true });
    });
  }
  return { y };
};
