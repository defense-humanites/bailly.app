/**
 * The bookmarks' quotas (`maxTags` tags, `tagMaxItems` entries per tag and
 * favorites, cf. `nuxt.config.ts`), told on the bookmarks page: the number of
 * tags in the new tag field, the number of entries of a card under its
 * entries. Each is shown from a share of its quota (`QUOTA_SHOWN_FROM`: 0,
 * always; the choice between always and only near the quota is still open),
 * and stands out from `QUOTA_NEAR`.
 */
export const QUOTA_SHOWN_FROM = { tags: 0, entries: 0.8 } as const;

export const QUOTA_NEAR = 0.9;

export const quotaShown = (count: number, max: number, kind: keyof typeof QUOTA_SHOWN_FROM): boolean =>
  count >= max * QUOTA_SHOWN_FROM[kind];

export const quotaNear = (count: number, max: number): boolean => count >= max * QUOTA_NEAR;
