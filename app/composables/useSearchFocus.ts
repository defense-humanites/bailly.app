/**
 * Lets any page give the focus to the header's search field (e.g. a "Search a
 * word" button): the search bar watches the requests, and takes the last one
 * when it mounts (it may mount after the page, cf. `AppNavHorizontal`).
 */
export function useSearchFocus() {
  const request = useState("search-focus-request", () => ({ count: 0, ifEmpty: false }));
  /** The count of the last request handled. */
  const handled = useState("search-focus-handled", () => 0);

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
    /**
     * The last request, if not handled yet (it then is).
     */
    take: (): { ifEmpty: boolean } | undefined => {
      if (request.value.count <= handled.value) return undefined;
      handled.value = request.value.count;
      return { ifEmpty: request.value.ifEmpty };
    },
  };
}
