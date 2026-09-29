/**
 * Lets any page give the focus to the header's search field (e.g. a "Search a
 * word" button): the search bar watches the requests.
 */
export function useSearchFocus() {
  const request = useState("search-focus-request", () => 0);

  return {
    /** Incremented on each request. */
    request: readonly(request),
    focus: (): void => {
      request.value++;
    },
  };
}
