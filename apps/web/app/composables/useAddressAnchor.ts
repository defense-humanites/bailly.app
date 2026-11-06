import { markQuietAnchor } from "~/utils/quietAnchor";

/**
 * Gives the address the anchor of what is being read (a section, a
 * homonym), or none, as the page scrolls: replaced through the router (not
 * added to the history; the router kept in step, so that a link to that
 * anchor still scrolls to it later), without scrolling to it (cf.
 * `takeQuietAnchor`, `router.options.ts`).
 * @returns A function giving the address an anchor (`id`), or none.
 */
export function useAddressAnchor(): (id: string | undefined) => void {
  // The router's current route (a page's own, `useRoute`, may lag).
  const router = useRouter();
  return (id) => {
    const hash = id ? `#${id}` : "";
    const { path, query, hash: current } = router.currentRoute.value;
    if (current === hash) return;
    const unmark = markQuietAnchor(hash);
    // Cleared after the router's scroll behavior (called just after the
    // navigation), should it not have been (e.g. a navigation aborted).
    void router.replace({ path, query, hash }).finally(() => setTimeout(unmark));
  };
}
