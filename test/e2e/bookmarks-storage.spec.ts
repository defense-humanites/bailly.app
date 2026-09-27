import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { bookmarksState, seedBookmarks, type AppRoot } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole" };

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

test("a change in a tab shows in the other tabs", async ({ page, goto, context, baseURL }) => {
  await goto("/signets", { waitUntil: "hydration" });
  const other = await context.newPage();
  await other.goto(`${baseURL}/signets`);
  await waitForHydration(other);

  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });

  await expect.poll(() => bookmarksState(other)).toEqual({ tags: ["Homère"], tagged: 1, starred: 1 });
});

test("the bookmarks of the previous schema (version 3) are migrated", async ({ page, baseURL }) => {
  // A page of the same origin that does not open the database.
  await page.route("**/blank", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>blank</title>" }));
  await page.goto(`${baseURL}/blank`);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("bailly", 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("history", { autoIncrement: true }).createIndex("uri", "uri");
      db.createObjectStore("starred", { autoIncrement: true }).createIndex("uri", "uri");
      const tagged = db.createObjectStore("tagged", { autoIncrement: true });
      tagged.createIndex("uri", "uri");
      tagged.createIndex("tagKey", "tagKey");
      tagged.createIndex("tagKey+uri", ["tagKey", "uri"], { unique: true });
      const tags = db.createObjectStore("tags", { autoIncrement: true });
      tags.createIndex("name", "name");
      tags.createIndex("position", "position");
      tags.add({ name: "Banquet", description: "", color: "Rose", position: 2 });
      tags.add({ name: "Théétète", description: "", color: "Blue", position: 1 });
      tagged.add({ tagKey: 1, word: "ἔρως", uri: "erôs", excerpt: "ἔρως amour" });
      request.transaction!.objectStore("starred").add({ word: "λόγος", uri: "logos", excerpt: "λόγος parole" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("open failed"));
    };
  }));
  // The current tag, as stored before the migration (its numeric key).
  await page.evaluate(() => {
    localStorage.setItem("bailly:currentTag", "1");
  });

  await page.goto(`${baseURL}/signets`);
  await waitForHydration(page);

  await expect.poll(() => bookmarksState(page)).toEqual({ tags: ["Théétète", "Banquet"], tagged: 1, starred: 1 });
  const current = await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { currentTag: { name: string } | null };
    return store.currentTag?.name;
  });
  expect(current).toBe("Banquet");
});
