import type { Directive } from "vue";

/**
 * `v-truncated-title`: on a text truncated by an ellipsis, its full text as
 * the native tooltip, set on hover, only while it is truncated. Safari shows
 * such a tooltip of itself, with the text as written (the dictionary's
 * medial beta, ϐ, odd in the system's font): a title takes precedence over
 * it, its Greek in the usual letters (`plainGreek`). Nothing is rendered by
 * the server. Not for a text with a tooltip of its own (`UTooltip`): two
 * tooltips at once confuse; there, the text lets the pointer through
 * (`pointer-events-none`), Safari showing nothing then.
 */
const update = (event: PointerEvent): void => {
  const element = event.currentTarget as HTMLElement;
  if (element.scrollWidth > element.clientWidth) element.title = plainGreek(element.textContent).trim();
  else element.removeAttribute("title");
};

const truncatedTitle: Directive<HTMLElement> = {
  mounted: (element) => {
    element.addEventListener("pointerenter", update);
  },
  beforeUnmount: (element) => {
    element.removeEventListener("pointerenter", update);
  },
  getSSRProps: () => ({}),
};

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive("truncated-title", truncatedTitle);
});

declare module "vue" {
  interface GlobalDirectives {
    vTruncatedTitle: typeof truncatedTitle;
  }
}
