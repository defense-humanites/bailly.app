/**
 * Resumes the toasts' timers when a toast is added or removed while neither
 * the focus nor the pointer is on them. Reka UI pauses them while the focus
 * is in their viewport (and while it is hovered), and resumes them when the
 * focus leaves it; but WebKit (Safari, every browser on iOS) fires no
 * `focusout` when the focused element is removed: a toast closed by its own
 * button (« Annuler », the close button) left the other toasts paused, and
 * as Reka UI keeps the pause once the viewport is empty, every next toast
 * stayed on screen for good. The missing `focusout` is dispatched to the
 * viewport, which resumes them (cf. reka-ui 2.11, `ToastViewport`).
 */
export default defineNuxtPlugin(() => {
  const { toasts } = useToast();

  watch(() => toasts.value.length, async (length) => {
    if (!length) return;
    // Once the toasts are rendered and the viewport listens to their events.
    await nextTick();
    requestAnimationFrame(() => {
      const viewport = document.querySelector(".app-toast")?.closest<HTMLElement>("[data-slot=viewport]");
      if (!viewport || viewport.contains(document.activeElement)) return;
      // A touch screen keeps the last touched element hovered.
      if (matchMedia("(hover: hover)").matches && viewport.matches(":hover")) return;
      viewport.dispatchEvent(new FocusEvent("focusout", { relatedTarget: null }));
    });
  }, { flush: "post" });
});
