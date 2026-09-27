/**
 * Holds the bookmarks shown while an interaction is in progress (e.g. editing
 * a tag, arranging the tags): the synchronization and the reloads asked by
 * other tabs wait until it is over, so that nothing changes under the user's
 * feet (cf. `bookmarksStore.hold`).
 * @param active Whether the interaction is in progress (by default, as long
 * as the calling component is mounted).
 */
export function useBookmarksHold(active: MaybeRefOrGetter<boolean> = true): void {
  const bookmarksStore = useBookmarksStore();
  let release: (() => void) | null = null;

  watch(() => toValue(active), (isActive) => {
    if (isActive && !release) {
      release = bookmarksStore.hold();
    } else if (!isActive && release) {
      release();
      release = null;
    }
  }, { immediate: true });

  onScopeDispose(() => {
    release?.();
    release = null;
  });
}
