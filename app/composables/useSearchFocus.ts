/**
 * Lets any page give the focus to the header's search field (e.g. a "Search a
 * word" button): the search bar watches the requests.
 */
export function useSearchFocus() {
  const request = useState("search-focus-request", () => ({ count: 0, ifEmpty: false }));

  return {
    /** Renewed on each request. */
    request: readonly(request),
    /**
     * @param options.ifEmpty Only if the field is empty (not when it holds a
     * search, whose results the focus would open again).
     */
    focus: (options: { ifEmpty?: boolean } = {}): void => {
      request.value = { count: request.value.count + 1, ifEmpty: options.ifEmpty ?? false };
    },
  };
}
