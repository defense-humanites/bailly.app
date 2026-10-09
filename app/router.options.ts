import type { RouterConfig } from "@nuxt/schema";
import type { RouteLocationNormalized } from "vue-router";
import { START_LOCATION } from "vue-router";
import { takeQuietAnchor } from "~/utils/quietAnchor";

const samePath = (to: RouteLocationNormalized, from: RouteLocationNormalized): boolean =>
  to.path.replace(/\/$/, "") === from.path.replace(/\/$/, "");

/**
 * The target of a hash (an element's id, e.g. `#2`, not always a valid
 * selector, cf. `EntryCard`).
 */
const hashTarget = (hash: string): HTMLElement | null => {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
};

/**
 * Scrolls the pages' scroller (cf. `usePageScroller`): to a hash's target
 * (its scroll margin above it), or to a position.
 */
function scrollPage(target: { hash: string } | { top: number }, behavior: ScrollBehavior = "instant"): void {
  const scroller = document.getElementById("page");
  if (!scroller) return;
  if ("top" in target) {
    scroller.scrollTo({ top: target.top, behavior });
    return;
  }
  const element = hashTarget(target.hash);
  if (!element) return;
  const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - margin;
  scroller.scrollTo({ top, behavior });
}

/**
 * Nuxt's scroll behavior (`nuxt/dist/pages/runtime/router.options.js`, which
 * an app's own replaces), applied to the pages' scroller rather than to the
 * window, which never scrolls (cf. `usePageScroller`): the router is told
 * not to scroll (`false`), the scroller is scrolled here. A link to an anchor
 * of the same page (the about page's « En savoir plus », the bookmarks'
 * table of contents) scrolls smoothly, unless the user prefers reduced
 * motion. Elsewhere, at once: the page's top for a new page, a hash's target
 * once it is rendered, the position kept going back or forward (cf.
 * `utils/pageScroll.ts`).
 */
export default {
  scrollBehavior(to, from, savedPosition) {
    if (samePath(to, from)) {
      // The anchor of what is being read, given as the page scrolls (cf.
      // `useAddressAnchor`): the page stays where it is.
      if (takeQuietAnchor(to.hash)) return false;
      if (from.hash && !to.hash) scrollPage({ top: (savedPosition && savedPageScroll()) || 0 });
      else if (to.hash) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollPage({ hash: to.hash }, reduced ? "instant" : "smooth");
      }
      return false;
    }
    const scrollToTop = to.meta.scrollToTop;
    if ((typeof scrollToTop === "function" ? scrollToTop(to, from) : scrollToTop) === false) return false;
    const scroll = (): void => {
      if (savedPosition) scrollPage({ top: savedPageScroll() ?? 0 });
      else if (to.hash) scrollPage({ hash: to.hash });
      else scrollPage({ top: 0 });
    };
    const nuxtApp = useNuxtApp();
    // On opening, to a hash's target once the page is hydrated.
    if (from === START_LOCATION) {
      if (to.hash) {
        nuxtApp.hooks.hookOnce("app:suspense:resolve", () => {
          requestAnimationFrame(scroll);
        });
      }
      return false;
    }
    const router = useRouter();
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce("page:loading:end", () => {
        const done = (): void => {
          requestAnimationFrame(() => {
            if (router.currentRoute.value.fullPath === to.fullPath) scroll();
            resolve(false);
          });
        };
        const transition = (nuxtApp as unknown as { "~transitionPromise"?: Promise<void> })["~transitionPromise"];
        if (transition) void transition.then(done);
        else done();
      });
    });
  },
} satisfies RouterConfig;
