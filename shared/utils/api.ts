/**
 * A value of an API parameter.
 */
export type ApiQueryValue = string | number | boolean | readonly (string | number | undefined)[] | undefined;

/**
 * Serializes parameters as the API expects them: lists are comma-separated;
 * undefined values are omitted.
 * @example toApiQuery({ fields: ["word", "uri"], siblings: true }) // { fields: "word,uri", siblings: "true" }
 */
export function toApiQuery(params: Record<string, ApiQueryValue>): Record<string, string> {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query[key] = Array.isArray(value)
      ? value.filter(item => item !== undefined).join(",")
      : String(value);
  }

  return query;
}

/**
 * Sorts lookup entries, exact matches first (the order is otherwise kept).
 */
export function sortLookupEntries<E extends { isExact: boolean }>(entries: readonly E[]): E[] {
  return [...entries].sort((a, b) => Number(b.isExact) - Number(a.isExact));
}
