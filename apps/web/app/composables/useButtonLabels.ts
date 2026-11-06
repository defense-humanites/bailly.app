/**
 * Whether the icon buttons (e.g. the header menu, the bookmarks actions) show
 * their label next to their icon: from `xl`. Below, they only show their
 * icon, their label being kept for screen readers and shown in a tooltip.
 * @remarks Only drives the tooltips' `disabled` state: the server doesn't know
 * the viewport width, and the markup must not change after hydration. The
 * labels themselves are hidden in CSS (`max-xl:sr-only`).
 */
export function useButtonLabels(): Readonly<Ref<boolean>> {
  return useMediaQuery("(min-width: 80rem)");
}
