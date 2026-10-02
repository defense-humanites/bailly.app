import type { IdbTagged, IdbTagWithKey } from "~/idb";

/**
 * How the tags that are not pinned are sorted on the bookmarks page (cards
 * and table of contents): by name (the store's order, cf. `orderTags`), by
 * number of entries, or by their latest addition (an entry added, or the
 * tag's creation). A choice of the device, not synchronized.
 */
export const TAG_SORTS = ["name", "count", "recent"] as const;
export type TagSort = typeof TAG_SORTS[number];

export const isTagSort = (value: unknown): value is TagSort => TAG_SORTS.includes(value as TagSort);

export const TAG_SORT_LABELS: Record<TagSort, string> = {
  name: "Par nom",
  count: "Par nombre d'entrées",
  recent: "Par ajout récent",
};

/**
 * Sorts the tags: the pinned ones first, as given (in the order of their
 * pinning), then the others by `sort`, ties kept by name.
 * @param tags The tags in the store's order (pinned, then by name).
 * @param entriesOf The entries of a tag, the latest added first.
 */
export function sortTags(
  tags: IdbTagWithKey[],
  sort: TagSort,
  entriesOf: (key: IdbTagWithKey["key"]) => IdbTagged[],
): IdbTagWithKey[] {
  if (sort === "name") return tags;
  const pinned = tags.filter(tag => tag.pinnedAt !== undefined);
  const others = tags.filter(tag => tag.pinnedAt === undefined);
  const value = new Map(others.map((tag): [string, number | string] => {
    const entries = entriesOf(tag.key);
    if (sort === "count") return [tag.key, entries.length];
    const latest = entries[0]?.addedAt;
    return [tag.key, latest !== undefined && latest > tag.createdAt ? latest : tag.createdAt];
  }));
  // A stable sort: equal values keep the order by name.
  others.sort((a, b) => {
    const [valueA, valueB] = [value.get(a.key)!, value.get(b.key)!];
    return valueA === valueB ? 0 : valueA > valueB ? -1 : 1;
  });
  return [...pinned, ...others];
}
