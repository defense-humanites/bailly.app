import { expect, test } from "@nuxt/test-utils/playwright";
import type { Browser, Page } from "@playwright/test";
import type { AppRoot } from "./helpers";

const PREFERENCES_PATH = encodeURI("/préférences");

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

/**
 * Another device: a new browser context (its own storage and cookies).
 */
async function newDevice(browser: Browser, baseURL: string | undefined, path = PREFERENCES_PATH): Promise<Page> {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(new URL(path, baseURL).href);
  await waitForHydration(page);
  return page;
}

type SyncStore = {
  link: (origin: string, scope?: string) => string | null;
  syncedBookmarks: boolean;
  syncedPreferences: string[];
};

const syncStore = (page: Page) => page.evaluate(() => {
  const root = document.querySelector("#__nuxt") as AppRoot;
  const store = root.__vue_app__.config.globalProperties.$pinia._s.get("sync") as unknown as SyncStore;
  return { link: store.link(window.location.origin, "preferences"), bookmarks: store.syncedBookmarks, preferences: [...store.syncedPreferences] };
});

const openSync = async (page: Page) => {
  await page.getByRole("button", { name: /^Synchronisation/ }).click();
};

const transliteration = (page: Page) => page.getByRole("switch", { name: "Grec translittéré" });
const inflectedForms = (page: Page) => page.getByRole("switch", { name: "Formes fléchies" });

/**
 * Reloads a device until a check passes (it synchronizes when loaded).
 */
const untilReloaded = async (page: Page, check: () => Promise<void>) => {
  await expect(async () => {
    await page.reload();
    await waitForHydration(page);
    await check();
  }).toPass({ timeout: 20_000 });
};

test("synchronizing the preferences chosen between two devices", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(90_000);

  // Laptop: transliterates Greek, then synchronizes its preferences.
  await goto(PREFERENCES_PATH, { waitUntil: "hydration" });
  await transliteration(page).click();
  await expect(transliteration(page)).toBeChecked();
  await openSync(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Synchroniser vos préférences")).toBeVisible();
  // Offered checked, but the input mode (it depends on the keyboard).
  await expect(dialog.getByRole("checkbox", { name: "Grec translittéré" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Formes fléchies" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Police" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /^Saisie/ })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Activer la synchronisation" }).click();
  await dialog.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(dialog.getByText("Préférences à jour")).toBeVisible();
  await page.keyboard.press("Escape");

  // A small cloud marks the preferences synchronized.
  await expect(page.locator("[data-synced]")).toHaveCount(3);
  // For screen readers, the controls say it.
  await expect(transliteration(page)).toHaveAccessibleName("Grec translittéré (réglage synchronisé avec vos autres appareils)");
  const { link, bookmarks } = await syncStore(page);
  expect(bookmarks).toBe(false);
  expect(link).toMatch(/\/pr%C3%A9f%C3%A9rences#sync=[\w-]{22}$/);

  // Phone: opens the link; it gets the laptop's preference.
  const phone = await newDevice(browser, baseURL, new URL(link!).pathname + new URL(link!).hash);
  await expect(phone.getByText("Activer la synchronisation sur cet appareil avec la clé de ce lien ?")).toBeVisible();
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Préférences à jour")).toBeVisible();
  await phone.keyboard.press("Escape");
  await expect(transliteration(phone)).toBeChecked();
  expect((await syncStore(phone)).preferences.sort()).toEqual(["inflectedForms", "readingFont", "transliterateGreek"]);

  // The phone also synchronizes its input mode; the laptop does not.
  await openSync(phone);
  await phone.getByRole("dialog").getByRole("checkbox", { name: /^Saisie/ }).click();
  await expect.poll(async () => (await syncStore(phone)).preferences).toContain("inputMode");
  await phone.keyboard.press("Escape");
  // (The label of a radio button of Nuxt UI takes the click.)
  await phone.locator("[data-slot=label]", { hasText: "Translittération" }).click();
  await expect(phone.getByRole("radio", { name: "Translittération" })).toBeChecked();

  // A change on the phone reaches the laptop; its input mode does not.
  await inflectedForms(phone).click();
  await expect(inflectedForms(phone)).not.toBeChecked();
  await untilReloaded(page, async () => {
    await expect(inflectedForms(page)).not.toBeChecked({ timeout: 2_000 });
  });
  await expect(page.getByRole("radio", { name: "Beta code" })).toBeChecked();

  // A reset on the laptop reaches the phone, for the preferences synchronized.
  await page.getByRole("button", { name: "Réinitialiser les préférences" }).click();
  await expect(page.getByText("Les préférences synchronisées seront aussi réinitialisées sur vos autres appareils.")).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
  await expect(transliteration(page)).not.toBeChecked();
  await untilReloaded(phone, async () => {
    await expect(transliteration(phone)).not.toBeChecked({ timeout: 2_000 });
    await expect(inflectedForms(phone)).toBeChecked({ timeout: 2_000 });
  });
});

test("the bookmarks and the preferences: one key, enabled and stopped type by type", async ({ page, goto }) => {
  test.setTimeout(60_000);

  // The bookmarks first, on their page.
  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Signets à jour")).toBeVisible();
  await page.keyboard.press("Escape");

  // Then the preferences, with the same key: through the link of the
  // preferences (e.g. scanned from another device that synchronizes them).
  const { link } = await syncStore(page);
  await page.goto(link!);
  await waitForHydration(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Cet appareil synchronise déjà ses signets avec la clé de ce lien.")).toBeVisible();
  await dialog.getByRole("button", { name: "Synchroniser aussi vos préférences" }).click();
  await expect(dialog.getByText("Préférences à jour")).toBeVisible();
  expect(await syncStore(page)).toMatchObject({ bookmarks: true });
  expect((await syncStore(page)).preferences).toHaveLength(3);

  // At least one preference stays checked.
  await dialog.getByRole("checkbox", { name: "Grec translittéré" }).click();
  await dialog.getByRole("checkbox", { name: "Formes fléchies" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Police" })).toBeDisabled();
  await expect.poll(async () => (await syncStore(page)).preferences).toEqual(["readingFont"]);

  // Stopping the preferences on this device: the bookmarks go on.
  await dialog.getByRole("button", { name: "Arrêter la synchronisation…" }).click();
  await expect(dialog.getByText("Vos signets restent synchronisés.")).toBeVisible();
  await dialog.getByRole("button", { name: "Désactiver sur cet appareil" }).click();
  await expect(page.getByText("Synchronisation des préférences désactivée sur cet appareil", { exact: true })).toBeVisible();
  expect(await syncStore(page)).toMatchObject({ bookmarks: true, preferences: [] });
  await expect(page.locator("[data-synced]")).toHaveCount(0);
});
