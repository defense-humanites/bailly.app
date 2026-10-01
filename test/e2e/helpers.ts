import type { Page } from "@playwright/test";

/**
 * The search field of the header.
 */
export const searchInput = (page: Page) => page.locator("header input[role=combobox]");

/**
 * The search bar (field and options button).
 */
/**
 * A length of `root.css`, in pixels (e.g. `--search-overhang`, `--reading-width`,
 * in rem): the tests follow the layout's values rather than repeat them.
 */
export async function rootLength(page: Page, name: string): Promise<number> {
  return page.evaluate((property) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return value.endsWith("rem") ? parseFloat(value) * rem : parseFloat(value);
  }, name);
}

export const searchBar = (page: Page) => page.locator("header .group\\/search");

/**
 * The results list of the search bar (once open).
 */
export const searchResults = (page: Page) => page.locator("[role=listbox]");

/**
 * The horizontal extent of the results popup, once its opening animation (a
 * scale) is over.
 */
export async function resultsExtent(page: Page): Promise<[number, number]> {
  return searchResults(page).evaluate(async (element) => {
    const content = element.closest("[data-slot=content]") ?? element;
    await Promise.all(content.getAnimations({ subtree: true }).map(animation => animation.finished));
    const { left, right } = content.getBoundingClientRect();
    return [Math.round(left * 10) / 10, Math.round(right * 10) / 10];
  });
}

/**
 * An element's horizontal extent, rounded to a tenth of a pixel.
 */
export async function xExtent(page: Page, selector: string): Promise<[number, number]> {
  return page.locator(selector).first().evaluate((element) => {
    const { left, right } = element.getBoundingClientRect();
    return [Math.round(left * 10) / 10, Math.round(right * 10) / 10];
  });
}

type Bookmark = { word: string; uri: string; excerpt: string; children?: Omit<Bookmark, "children">[] };

/**
 * The part of the bookmarks store the tests use.
 */
interface BookmarksStore {
  initialize: () => Promise<void>;
  starEntry: (entry: Bookmark) => Promise<unknown>;
  createTag: (tag: { name: string; color: string }) => Promise<{ data: { key: string } }>;
  tagEntry: (entry: Bookmark, tagKey: string) => Promise<unknown>;
  setCurrentTag: (key: string) => void;
  tagKeysOf: (uri: string) => string[];
  tags: { name: string; key: string }[];
  taggedEntries: unknown[];
  starredEntries: unknown[];
}

/**
 * The app's root element, through which the tests reach its Pinia stores.
 */
export type AppRoot = Element & {
  __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, BookmarksStore> } } } };
};

/**
 * Adds bookmarks through the app's store (IndexedDB), then reloads the page
 * (and waits for its hydration).
 * @param tags Tags to create, in this order (a new tag goes first, and becomes
 * the current one), with their entries.
 * @param current The name of the tag to make current afterwards.
 */
export async function seedBookmarks(
  page: Page,
  { starred = [], tags = [], current }: { starred?: Bookmark[]; tags?: { name: string; color: string; entries?: Bookmark[] }[]; current?: string },
): Promise<void> {
  await page.evaluate(async ({ starred, tags, current }) => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks")!;
    await store.initialize();
    for (const entry of starred) await store.starEntry(entry);
    for (const { name, color, entries = [] } of tags) {
      const { data } = await store.createTag({ name, color });
      for (const entry of entries) await store.tagEntry(entry, data.key);
    }
    const currentKey = store.tags.find(tag => tag.name === current)?.key;
    if (currentKey !== undefined) store.setCurrentTag(currentKey);
    // Let the current tag reach `localStorage` before the reload.
    await new Promise(resolve => setTimeout(resolve, 50));
  }, { starred, tags, current });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);
}

/**
 * The bookmarks as stored: the tag names (in order) and the numbers of tagged
 * and starred entries.
 */
export function bookmarksState(page: Page): Promise<{ tags: string[]; tagged: number; starred: number }> {
  return page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks")!;
    return { tags: store.tags.map(tag => tag.name), tagged: store.taggedEntries.length, starred: store.starredEntries.length };
  });
}

/**
 * The names of the tags to which an entry belongs, in the user's order.
 */
export function tagNamesOf(page: Page, uri: string): Promise<string[]> {
  return page.evaluate((uri) => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks")!;
    const keys = new Set(store.tagKeysOf(uri));
    return store.tags.filter(tag => keys.has(tag.key)).map(tag => tag.name);
  }, uri);
}
