/**
 * The anchors (`#id`, or `""` for none) the address is being given without
 * scrolling to them (cf. `useAddressAnchor`), for the router's scroll
 * behavior to let them be (cf. `router.options.ts`). Several at once: the
 * page may scroll on before the router has scrolled (or not) for the
 * previous one.
 */
const quiet = new Set<string>();

/**
 * Marks an anchor about to be given quietly.
 * @returns A function clearing the mark (once the navigation is over,
 *   whether the router scrolled for it or not).
 */
export function markQuietAnchor(hash: string): () => void {
  quiet.add(hash);
  return () => {
    quiet.delete(hash);
  };
}

/** Whether a navigation within the page, to `hash`, is a quiet one. */
export function takeQuietAnchor(hash: string): boolean {
  return quiet.delete(hash);
}
