import { describe, expect, it } from "vitest";
import type { IdbTagged, IdbTagWithKey } from "../../app/idb";
import { quotaNear, quotaShown } from "../../app/utils/quotas";
import { sortTags } from "../../app/utils/tagSort";

const tag = (key: string, name: string, createdAt: string, pinnedAt?: string): IdbTagWithKey =>
  ({ key, name, description: "", color: "Blue", createdAt, ...(pinnedAt ? { pinnedAt } : {}) });
const entry = (tagKey: string, addedAt: string): IdbTagged => ({ tagKey, word: "λόγος", uri: "logos", excerpt: "", addedAt });

describe("sortTags", () => {
  // In the store's order: the pinned first, then by name.
  const tags = [tag("p", "Pinned", "0001", "0009"), tag("a", "Alpha", "0002"), tag("b", "Bêta", "0003"), tag("c", "Gamma", "0004")];
  const entries: Record<string, IdbTagged[]> = {
    a: [],
    b: [entry("b", "0008"), entry("b", "0005")],
    c: [entry("c", "0006")],
    p: [entry("p", "0010"), entry("p", "0011"), entry("p", "0012")],
  };
  const entriesOf = (key: string) => entries[key] ?? [];
  const keys = (sorted: IdbTagWithKey[]) => sorted.map(({ key }) => key);

  it("keeps the store's order by name", () => {
    expect(keys(sortTags(tags, "name", entriesOf))).toEqual(["p", "a", "b", "c"]);
  });

  it("sorts the others by number of entries, the pinned staying first", () => {
    expect(keys(sortTags(tags, "count", entriesOf))).toEqual(["p", "b", "c", "a"]);
  });

  it("sorts the others by their latest addition, or their creation", () => {
    expect(keys(sortTags(tags, "recent", entriesOf))).toEqual(["p", "b", "c", "a"]);
    // A tag created after the latest additions comes first.
    expect(keys(sortTags([...tags, tag("d", "Delta", "0099")], "recent", entriesOf))).toEqual(["p", "d", "b", "c", "a"]);
  });

  it("keeps the order by name between equals", () => {
    expect(keys(sortTags([tag("x", "X", "0001"), tag("y", "Y", "0001")], "count", () => []))).toEqual(["x", "y"]);
  });
});

describe("quotas", () => {
  it("shows the tags always, the entries near their quota", () => {
    expect(quotaShown(0, 50, "tags")).toBe(true);
    expect(quotaShown(79, 100, "entries")).toBe(false);
    expect(quotaShown(80, 100, "entries")).toBe(true);
    expect(quotaNear(44, 50)).toBe(false);
    expect(quotaNear(45, 50)).toBe(true);
  });
});
