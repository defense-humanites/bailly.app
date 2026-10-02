import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { bookmarksState, seedBookmarks, type AppRoot } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole" };

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

test("a change in a tab shows in the other tabs", async ({ page, goto, context, baseURL }) => {
  await goto("/signets", { waitUntil: "hydration" });
  const other = await context.newPage();
  await other.goto(new URL("/signets", baseURL).href);
  await waitForHydration(other);

  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });

  await expect.poll(() => bookmarksState(other)).toEqual({ tags: ["Homère"], tagged: 1, starred: 1 });
});

test("the bookmarks of the previous schema (version 3) are migrated", async ({ page, baseURL }) => {
  // A page of the same origin that does not open the database.
  await page.route("**/blank", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>blank</title>" }));
  await page.goto(new URL("/blank", baseURL).href);
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

  await page.goto(new URL("/signets", baseURL).href);
  await waitForHydration(page);

  // By name: their former order is not kept.
  await expect.poll(() => bookmarksState(page)).toEqual({ tags: ["Banquet", "Théétète"], tagged: 1, starred: 1 });
  const current = await page.evaluate(() => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { currentTag: { name: string } | null };
    return store.currentTag?.name;
  });
  expect(current).toBe("Banquet");
});

test("export, then import on another device (menu of the bookmarks page)", async ({ page, goto, browser, baseURL }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });

  await page.getByRole("button", { name: "Fichier" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Exporter les signets" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^bailly-signets-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  await expect(page.getByText("Signets exportés", { exact: true })).toBeVisible();

  // Another device: a new browser context, with its own storage.
  const context = await browser.newContext({ locale: "fr-FR" });
  const other = await context.newPage();
  await other.goto(new URL("/signets", baseURL).href);
  await waitForHydration(other);

  await other.getByRole("button", { name: "Fichier" }).click();
  const [chooser] = await Promise.all([
    other.waitForEvent("filechooser"),
    other.getByRole("menuitem", { name: "Importer des signets" }).click(),
  ]);
  await chooser.setFiles(path);

  await expect(other.getByText("Ajout : 1 étiquette et 2 entrées.", { exact: true })).toBeVisible();
  expect(await bookmarksState(other)).toEqual({ tags: ["Homère"], tagged: 1, starred: 1 });

  // Importing again adds nothing.
  await other.getByRole("button", { name: "Fichier" }).click();
  const [again] = await Promise.all([
    other.waitForEvent("filechooser"),
    other.getByRole("menuitem", { name: "Importer des signets" }).click(),
  ]);
  await again.setFiles(path);
  await expect(other.getByText("Tous les signets de ce fichier étaient déjà là.", { exact: true })).toBeVisible();
  await context.close();
});

test("an import restores the bookmarks deleted since the export", async ({ page, goto }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });

  await page.getByRole("button", { name: "Fichier" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Exporter les signets" }).click(),
  ]);
  const path = await download.path();

  // Everything deleted.
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as {
      tags: { key: string }[];
      removeTag: (key: string) => Promise<unknown>;
      unstarEntry: (uri: string) => Promise<unknown>;
    };
    for (const tag of [...store.tags]) await store.removeTag(tag.key);
    await store.unstarEntry("logos");
  });
  await expect.poll(() => bookmarksState(page)).toEqual({ tags: [], tagged: 0, starred: 0 });

  await page.getByRole("button", { name: "Fichier" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "Importer des signets" }).click(),
  ]);
  await chooser.setFiles(path);

  await expect(page.getByText("Ajout : 1 étiquette et 2 entrées.", { exact: true })).toBeVisible();
  expect(await bookmarksState(page)).toEqual({ tags: ["Homère"], tagged: 1, starred: 1 });
});

test("an import beyond the limits asks first, then leaves out what does not fit", async ({ page, goto }) => {
  test.setTimeout(60_000);
  const hundred = Array.from({ length: 100 }, (_, i) => ({ word: `mot${i}`, uri: `mot-${i}`, excerpt: `mot${i}, extrait` }));
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: hundred });

  const stamp = `${String(Date.now()).padStart(13, "0")}-0000-e2e`;
  const file = {
    format: "bailly-bookmarks",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: {
      tags: [{ key: "4b8c3c1e-5a4e-4f0e-9d7a-1c2b3d4e5f60", name: "Homère", description: "", color: "Blue", createdAt: stamp, updatedAt: stamp }],
      tagged: [{ tagKey: "4b8c3c1e-5a4e-4f0e-9d7a-1c2b3d4e5f60", ...logos, updatedAt: stamp }],
      starred: [{ ...logos, updatedAt: stamp }, { word: "ψυχή", uri: "psuchê", excerpt: "ψυχή, ῆς (ἡ) souffle", updatedAt: stamp }],
    },
  };

  await page.getByRole("button", { name: "Fichier" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "Importer des signets" }).click(),
  ]);
  await chooser.setFiles({ name: "signets.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)) });

  await expect(page.getByText(/2 entrées de ce fichier ne tiennent pas dans les limites/)).toBeVisible();
  await page.getByRole("button", { name: "Importer les autres" }).click();
  await expect(page.getByText("Ajout : 1 étiquette et 1 entrée.", { exact: true })).toBeVisible();
  expect(await bookmarksState(page)).toEqual({ tags: ["Homère"], tagged: 1, starred: 100 });
});
