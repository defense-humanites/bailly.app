import type { RouterConfig } from "@nuxt/schema";
import type { RouteLocationNormalized } from "vue-router";
import { START_LOCATION } from "vue-router";

/**
 * The scroll margin of a hash's target (cf. `scroll-margin-top`), as Nuxt
 * reads it.
 */
function scrollMarginTop(selector: string): number {
  try {
    const element = document.querySelector(selector);
    if (element) {
      return (Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0)
        + (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    }
  } catch {
    // An invalid selector (e.g. `#2`, cf. `EntryCard`).
  }
  return 0;
}

const samePath = (to: RouteLocationNormalized, from: RouteLocationNormalized): boolean =>
  to.path.replace(/\/$/, "") === from.path.replace(/\/$/, "");

/**
 * Nuxt's scroll behavior (`nuxt/dist/pages/runtime/router.options.js`, which
 * an app's own replaces), except that a link to an anchor of the same page
 * (the about page's « En savoir plus », the bookmarks' table of contents)
 * scrolls smoothly, unless the user prefers reduced motion. Elsewhere, as
 * before: at once (the page's own position for a new page, a hash's target
 * once it is rendered, the saved position going back).
 */
export default {
  scrollBehavior(to, from, savedPosition) {
    if (samePath(to, from)) {
      if (from.hash && !to.hash) return savedPosition ?? { left: 0, top: 0 };
      if (to.hash) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        return { el: to.hash, top: scrollMarginTop(to.hash), behavior: reduced ? "instant" : "smooth" };
      }
      return false;
    }
    const scrollToTop = to.meta.scrollToTop;
    if ((typeof scrollToTop === "function" ? scrollToTop(to, from) : scrollToTop) === false) return false;
    const position = () => {
      if (savedPosition) return savedPosition;
      if (to.hash) return { el: to.hash, top: scrollMarginTop(to.hash), behavior: "instant" as const };
      return { left: 0, top: 0 };
    };
    if (from === START_LOCATION) return position();
    const nuxtApp = useNuxtApp();
    const router = useRouter();
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce("page:loading:end", () => {
        const done = (): void => {
          requestAnimationFrame(() => {
            resolve(router.currentRoute.value.fullPath === to.fullPath ? position() : false);
          });
        };
        const transition = (nuxtApp as unknown as { "~transitionPromise"?: Promise<void> })["~transitionPromise"];
        if (transition) void transition.then(done);
        else done();
      });
    });
  },
} satisfies RouterConfig;
