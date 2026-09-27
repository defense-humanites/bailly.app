import { expect, test } from "@nuxt/test-utils/playwright";
import type { Browser, Page } from "@playwright/test";
import { bookmarksState, seedBookmarks, type AppRoot } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole" };
const psukhe = { word: "ψυχή", uri: "psukhê", excerpt: "ψυχή, ῆς (ἡ) souffle, âme" };

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

/**
 * Another device: a new browser context (its own storage), on the bookmarks
 * page.
 */
async function newDevice(browser: Browser, baseURL: string | undefined, path = "/signets"): Promise<Page> {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(new URL(path, baseURL).href);
  await waitForHydration(page);
  return page;
}

const openSync = async (page: Page) => {
  await page.getByRole("button", { name: "Sauvegarde des signets" }).click();
  await page.getByRole("menuitem", { name: /^Synchronis/ }).click();
};

const syncLink = (page: Page) => page.evaluate(() => {
  const root = document.querySelector("#__nuxt") as AppRoot;
  const store = root.__vue_app__.config.globalProperties.$pinia._s.get("sync") as unknown as { link: (origin: string) => string | null };
  return store.link(window.location.origin);
});

test("synchronizing the bookmarks of three devices, then deleting them online", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(60_000);

  // Laptop: enables the synchronization, and reads its key.
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  const keyWords = page.getByRole("list", { name: "Les 12 mots de la clé" }).locator("li > span:last-child");
  await expect(keyWords).toHaveCount(12);
  const words = await keyWords.allInnerTexts();
  await expect(page.getByRole("img", { name: "QR code de la clé" }).locator("svg")).toBeVisible();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await page.keyboard.press("Escape");

  // Phone: has a favorite of its own, and joins with the 12 words (typed
  // without accents, in capitals).
  const phone = await newDevice(browser, baseURL);
  await seedBookmarks(phone, { starred: [psukhe] });
  await openSync(phone);
  await phone.getByRole("button", { name: "J'ai déjà une clé" }).click();
  await phone.getByRole("textbox").fill(words.map(word => word.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()).join(" "));
  await phone.getByRole("button", { name: "Rejoindre" }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect(await bookmarksState(phone)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });

  // The laptop gets the phone's favorite (e.g. at the next visit).
  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => bookmarksState(page)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });

  // A tablet opens the link of the QR code.
  const link = await syncLink(page);
  expect(link).toMatch(/\/signets#sync=[\w-]{22}$/);
  const tablet = await newDevice(browser, baseURL, new URL(link!).pathname + new URL(link!).hash);
  await expect(tablet.getByText("Activer la synchronisation sur cet appareil avec la clé de ce lien ?")).toBeVisible();
  expect(new URL(tablet.url()).hash).toBe(""); // The key leaves the address.
  await tablet.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(tablet.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect(await bookmarksState(tablet)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });

  // A change on the tablet reaches the laptop.
  await tablet.keyboard.press("Escape");
  await seedBookmarks(tablet, { tags: [{ name: "Platon", color: "Rose" }] });
  await expect.poll(async () => {
    await page.reload();
    await waitForHydration(page);
    return (await bookmarksState(page)).tags;
  }, { timeout: 15_000 }).toEqual(["Platon", "Homère"]);

  // The laptop deletes the bookmarks online: the phone stops synchronizing,
  // and keeps its bookmarks.
  await openSync(page);
  await page.getByRole("button", { name: "Supprimer les signets en ligne" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Signets supprimés du serveur", { exact: true })).toBeVisible();

  await phone.reload();
  await waitForHydration(phone);
  await openSync(phone);
  await expect(phone.getByText("La synchronisation a été désactivée depuis un autre appareil.")).toBeVisible();
  expect((await bookmarksState(phone)).starred).toBe(2);
});

test("a wrong key is explained", async ({ goto, page }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "J'ai déjà une clé" }).click();

  await page.getByRole("textbox").fill("abaisser zzzz ");
  await expect(page.getByText("« zzzz » n'est pas un mot de la liste.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejoindre" })).toBeDisabled();

  // Twelve valid words that no device synchronizes.
  await page.getByRole("textbox").fill(Array(12).fill("abaisser").join(" "));
  await page.getByRole("button", { name: "Rejoindre" }).click();
  await expect(page.getByText(/ne forment pas une clé valide|Aucun signet n'est synchronisé avec cette clé/)).toBeVisible();
});
