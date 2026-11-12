/**
 * The pressed state of the interactive elements, as `data-pressed` (the
 * `active` variant follows it, cf. `theme.css`): set on a pointer down,
 * removed on its release once shown for `MINIMUM_PRESS` ms at least. A tap
 * on a touch screen lasts a fraction of a second, too short for `:active`
 * to show (Safari on iOS does not even apply it without a `touchstart`
 * listener); as Material's ripple (225 ms) or Ionic's activated state
 * (150 ms), the pressed state stays visible a moment. Removed at once when
 * the pointer is cancelled, moves away from where it was pressed
 * (`MOVE_TOLERANCE`), or something scrolls: a touch that scrolls the page
 * (browsers do not always cancel the pointer). The same
 * for every pointer: a mouse's press lasts longer anyway. Not on a disabled
 * element, nor under `data-no-press`.
 */
const PRESSABLE = "button, a[href], [role=button], [role=switch], [role=tab], [role=radio], [role=checkbox], summary";

/** The shortest time the pressed state shows (ms). */
const MINIMUM_PRESS = 150;

/** How far a pressed pointer may move before the press is cancelled (px). */
const MOVE_TOLERANCE = 10;

export default defineNuxtPlugin(() => {
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  let current: { element: HTMLElement; since: number; x: number; y: number } | null = null;

  const unpress = (element: HTMLElement): void => {
    clearTimeout(timers.get(element));
    timers.delete(element);
    delete element.dataset.pressed;
  };

  /** The press ends: at once if cancelled, otherwise once shown long enough. */
  const end = (cancelled: boolean): void => {
    if (!current) return;
    const { element, since } = current;
    current = null;
    const left = cancelled ? 0 : MINIMUM_PRESS - (performance.now() - since);
    if (left <= 0) {
      unpress(element);
      return;
    }
    timers.set(element, setTimeout(() => {
      unpress(element);
    }, left));
  };

  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    end(false);
    const element = (event.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
    if (!element || element.matches(":disabled, [aria-disabled=true]") || element.closest("[data-no-press]")) return;
    clearTimeout(timers.get(element));
    element.dataset.pressed = "";
    current = { element, since: performance.now(), x: event.clientX, y: event.clientY };
  }, { capture: true, passive: true });
  document.addEventListener("pointermove", (event) => {
    if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) > MOVE_TOLERANCE) end(true);
  }, { capture: true, passive: true });
  document.addEventListener("pointerup", () => {
    end(false);
  }, { capture: true, passive: true });
  document.addEventListener("pointercancel", () => {
    end(true);
  }, { capture: true, passive: true });
  document.addEventListener("scroll", () => {
    end(true);
  }, { capture: true, passive: true });
  window.addEventListener("blur", () => {
    end(true);
  });
});
