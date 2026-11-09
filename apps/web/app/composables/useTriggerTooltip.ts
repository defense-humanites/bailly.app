/**
 * The tooltip naming an icon button that opens a panel (a popover, a
 * window): not while the panel is open, nor for the focus given back to the
 * button as the panel closes, which shows it even when the panel was opened
 * with the pointer (closed by Escape, the focus is a keyboard's), where it
 * flashed or stayed over the button. Shown again once the pointer comes
 * over the button anew or the focus leaves it. The tooltip ignores the
 * focus that isn't a keyboard's (`ignore-non-keyboard-focus`): on a touch
 * screen, the focus given back after a touch.
 *
 * Its opening refused (`open`, controlled) rather than the tooltip disabled:
 * Reka's trigger, disabled, drops its listeners, and a pointer that had
 * opened it before the panel (`hasPointerMoveOpened`, reset as it leaves)
 * would not open it again.
 *
 *   const { open: tooltipOpen, setOpen: setTooltipOpen, listeners: tooltipListeners } = useTriggerTooltip(open);
 *   <UTooltip text="…" :open="tooltipOpen" ignore-non-keyboard-focus @update:open="setTooltipOpen">
 *     <UButton v-bind="tooltipListeners" … />
 *   </UTooltip>
 */
export function useTriggerTooltip(open: Readonly<Ref<boolean>>): {
  open: Readonly<Ref<boolean>>;
  setOpen: (value: boolean) => void;
  listeners: { onPointerenter: () => void; onPointerleave: () => void; onBlur: () => void };
} {
  const tooltipOpen = shallowRef(false);
  const quiet = shallowRef(false);
  watch(open, (isOpen) => {
    if (!isOpen) return;
    quiet.value = true;
    tooltipOpen.value = false;
  });
  // Not while open: the focus leaves the button for the panel.
  const wake = (): void => {
    if (!open.value) quiet.value = false;
  };
  return {
    open: tooltipOpen,
    setOpen: (value: boolean): void => {
      tooltipOpen.value = value && !open.value && !quiet.value;
    },
    listeners: { onPointerenter: wake, onPointerleave: wake, onBlur: wake },
  };
}
