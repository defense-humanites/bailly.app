import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";

// The notice of an outdated browser (cf. `app/assets/outdated-browser.js`):
// an old browser is simulated by `color-mix()` reported unsupported.
const simulateOldBrowser = (page: Page) => page.addInitScript(() => {
  const supports = CSS.supports.bind(CSS);
  CSS.supports = (property: string, value?: string): boolean => {
    if (`${property} ${value ?? ""}`.includes("color-mix")) return false;
    return value === undefined ? supports(property) : supports(property, value);
  };
});

const notice = (page: Page) => page.locator("[data-outdated-browser]");

test.describe("an outdated browser", () => {
  test("none in an up-to-date browser", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await expect(notice(page)).toHaveCount(0);
  });

  test("a notice before the application, closed for the session", async ({ page, context, goto }) => {
    await simulateOldBrowser(page);
    await goto("/logos", { waitUntil: "hydration" });
    // Named by its title.
    await expect(page.getByRole("region", { name: "Navigateur trop ancien" })).toContainText("certaines fonctions, comme la recherche, ne fonctionnent pas");
    // Out of the application: Nuxt's error screen wouldn't replace it.
    expect(await page.evaluate(() => document.body.firstElementChild?.hasAttribute("data-outdated-browser"))).toBe(true);
    await notice(page).getByRole("button", { name: "Fermer" }).click();
    await expect(notice(page)).toHaveCount(0);
    await goto("/logades", { waitUntil: "hydration" });
    await expect(notice(page)).toHaveCount(0);
    // Another tab, another session: it's back.
    const other = await context.newPage();
    await simulateOldBrowser(other);
    await other.goto(page.url());
    await expect(notice(other)).toHaveCount(1);
  });

  test.describe("in the dark theme", () => {
    test.use({ colorScheme: "dark" });

    test("in its colors", async ({ page, goto }) => {
      await simulateOldBrowser(page);
      await goto("/logos", { waitUntil: "hydration" });
      await expect(notice(page)).toHaveCSS("background-color", "rgb(99, 41, 31)");
    });
  });
});

test.describe("an iPhone under iOS 15", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1" });

  test("told frankly that changing browsers won't help", async ({ page, goto }) => {
    await simulateOldBrowser(page);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.getByRole("region", { name: "Version d’iOS trop ancienne" })).toContainText("iOS 15");
    await expect(notice(page)).toContainText("changer de navigateur n’y fera rien");
  });

  test("closed for a month: there, the reader can do nothing about it", async ({ page, context, goto }) => {
    await simulateOldBrowser(page);
    await goto("/logos", { waitUntil: "hydration" });
    await notice(page).getByRole("button", { name: "Fermer" }).click();
    const other = await context.newPage();
    await simulateOldBrowser(other);
    await other.goto(page.url());
    await expect(other.locator("main")).toBeVisible();
    await expect(notice(other)).toHaveCount(0);
    const until = Number(await other.evaluate(() => localStorage.getItem("bailly:outdatedBrowser")));
    expect(until - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
});
