/**
 * Lets any page open the search options' panel (e.g. a key named in a text,
 * cf. the news): the panel watches the requests (cf. `SearchOptions`).
 */
export function useSearchOptionsPanel() {
  const request = useState("search-options-request", () => 0);

  return {
    /** Renewed on each request. */
    request: readonly(request),
    open: (): void => {
      request.value++;
    },
  };
}
