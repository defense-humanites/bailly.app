/**
 * A toggle button's state as shown (its icon, its color), in step with its
 * pressed state (`data-pressed`, cf. `pressed.client.ts`): pressed, the
 * button takes its pressed shade; released, the new state shows as the
 * shade fades, its icon popping when the user turned it on (`pop`). Shown
 * as soon as it changed, the state came in the middle of the press (the
 * click comes at the release, the press lasts 150 ms at least): the shade,
 * the icon, then the shade's fading, out of step. A state changed
 * otherwise (the bookmarks loaded, synchronized, changed in another tab)
 * shows at once, without a pop.
 * @param button The button (its element), whose pressed state is followed.
 * @param state The state (e.g. whether the entry is starred).
 */
export function useToggleFeedback(button: () => HTMLElement | null | undefined, state: Readonly<Ref<boolean>>): {
  shown: Readonly<Ref<boolean>>;
  pop: Readonly<Ref<boolean>>;
  /** The user acts on the button (its click): the state's change may pop. */
  act: () => void;
  /** The pop ended (its icon's `animationend`). */
  popped: () => void;
} {
  const shown = ref(state.value);
  const pop = ref(false);
  let acted = false;
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopWaiting = (): void => {
    observer?.disconnect();
    observer = undefined;
    clearTimeout(timer);
  };

  const show = (): void => {
    stopWaiting();
    const value = state.value;
    const popping = acted && value && !shown.value;
    acted = false;
    shown.value = value;
    // Again from its start if it was popping.
    pop.value = false;
    if (popping) requestAnimationFrame(() => {
      pop.value = true;
    });
  };

  watch(state, () => {
    const element = button();
    if (!element?.hasAttribute("data-pressed")) {
      show();
      return;
    }
    stopWaiting();
    observer = new MutationObserver(() => {
      if (!element.hasAttribute("data-pressed")) show();
    });
    observer.observe(element, { attributes: true, attributeFilter: ["data-pressed"] });
    // Never longer than a press's (cf. `MINIMUM_PRESS`), whatever happens.
    timer = setTimeout(show, 400);
  });
  onBeforeUnmount(stopWaiting);

  return {
    shown,
    pop,
    act: () => {
      acted = true;
    },
    popped: () => {
      pop.value = false;
    },
  };
}
