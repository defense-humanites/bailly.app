import type { ShallowRef } from "vue";

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

/**
 * The pages' scroll (cf. `usePageScroller`), as `useWindowScroll` would give
 * the window's.
 */
export const usePageScroll = () => useScroll(scroller);
