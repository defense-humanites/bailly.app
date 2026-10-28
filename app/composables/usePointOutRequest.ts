/** How long a request waits for its control, at most (ms): its page's loading. */
const REQUEST_LIFETIME = 5000;

/**
 * Once the page reached has scrolled to its top (cf. `router.options.ts`,
 * after the page's loading), the control is pointed out (ms).
 */
const ARRIVAL_DELAY = 350;

/**
 * Lets a page point out a control of another, reached by a link (e.g. a
 * home page's tip leading to the bookmarks' synchronization button): the
 * request waits for the control, which takes it as it mounts, then is
 * pointed out (`pointOut`, once in view: `revealThen`) in the primary
 * color, as every control pointed out from elsewhere. A request not taken
 * soon (the navigation given up) is forgotten.
 */
export function usePointOutRequest() {
  const request = useState<{ target: string; at: number } | null>("point-out-request", () => null);

  return {
    /** Asks for `target` to be pointed out (before leading to its page). */
    request: (target: string): void => {
      request.value = { target, at: Date.now() };
    },
    /**
     * Points out `element` if `target` was requested (lately), once the
     * page has scrolled to its top.
     */
    take: (target: string, element: () => HTMLElement | null | undefined): void => {
      const current = request.value;
      if (current?.target !== target) return;
      request.value = null;
      if (Date.now() - current.at > REQUEST_LIFETIME) return;
      setTimeout(() => {
        const found = element();
        if (!found) return;
        found.style.setProperty("--card-highlight", "var(--ui-primary)");
        revealThen(found, () => {
          pointOut(found);
        });
      }, ARRIVAL_DELAY);
    },
  };
}
