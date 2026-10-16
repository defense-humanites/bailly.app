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

const notice = (page: Page) => page.getByRole("region", { name: "Navigateur trop ancien" });

test.describe("an outdated browser", () => {
  test("none in an up-to-date browser", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("[data-outdated-browser]")).toHaveCount(0);
  });

  test("a notice before the application, closed for the session", async ({ page, goto }) => {
    await simulateOldBrowser(page);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(notice(page)).toContainText("Votre navigateur est trop ancien pour Bailly.app");
    // Out of the application: Nuxt's error screen wouldn't replace it.
    expect(await page.evaluate(() => document.body.firstElementChild?.hasAttribute("data-outdated-browser"))).toBe(true);
    await notice(page).getByRole("button", { name: "Fermer" }).click();
    await expect(notice(page)).toHaveCount(0);
    await goto("/logades", { waitUntil: "hydration" });
    await expect(page.locator("[data-outdated-browser]")).toHaveCount(0);
  });
});

test.describe("an iPhone under iOS 15", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1" });

  test("told frankly that changing browsers won't help", async ({ page, goto }) => {
    await simulateOldBrowser(page);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(notice(page)).toContainText("iOS 15");
    await expect(notice(page)).toContainText("changer de navigateur n’y fera rien");
  });
});
