/**
 * Whether the tooltips naming the icon buttons (below `xl`, cf.
 * `useButtonLabels`) are shown: not on a screen without hover (a phone, a
 * tablet), where they would only show as the focus comes back to their button
 * (a menu closed after a touch), a stray name; the label stays for screen
 * readers.
 * @remarks As `useButtonLabels`, only drives the tooltips' `disabled` state.
 */
export function useIconButtonTooltips(): Readonly<Ref<boolean>> {
  const showButtonLabels = useButtonLabels();
  const canHover = useMediaQuery("(hover: hover)");
  return computed(() => !showButtonLabels.value && canHover.value);
}
