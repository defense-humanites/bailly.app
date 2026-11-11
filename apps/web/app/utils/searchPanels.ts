import type { InjectionKey } from "vue";

/**
 * Closes the search results, if shown, and resolves once their panel is
 * gone (its animation ended): provided by the search bar (`SearchBar`) to
 * its buttons' panels (history, options), which open in the results' place
 * only then. Both animated at once, one fading out over the other fading
 * in, the two panels were mixed up; without the results' animation, the
 * page showed between them.
 */
export const closeSearchResultsKey: InjectionKey<() => Promise<void>> = Symbol("closeSearchResults");

/**
 * The search bar's closing of its results, for its buttons' panels (cf.
 * `closeSearchResultsKey`): nothing to wait for outside a search bar.
 */
export function useCloseSearchResults(): () => Promise<void> {
  return inject(closeSearchResultsKey, () => Promise.resolve());
}
