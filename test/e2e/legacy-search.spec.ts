import { expect, test } from "@nuxt/test-utils/playwright";

/**
 * The former search links (`/q=<Greek form>`, e.g. from gaffiot.fr).
 */
test.describe("former search links", () => {
  const path = (form: string) => `/q=${encodeURIComponent(form)}`;

  test("a headword leads to its entry", async ({ page }) => {
    const response = await page.goto(path("λόγος"));
    expect(response?.request().redirectedFrom()?.url()).toContain("/q=");
    await expect(page).toHaveURL(/\/logos$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("λόγος");
  });

  test("a link from gaffiot.fr: a proper noun, with its case and diacritics", async ({ page }) => {
    await page.goto(path("Πολέμων"));
    await expect(page).toHaveURL(new RegExp(`/${encodeURIComponent("Polemôn")}$`));
  });

  test("a form without its diacritics, too", async ({ page }) => {
    await page.goto(path("ανηρ"));
    await expect(page).toHaveURL(new RegExp(`/${encodeURIComponent("anêr")}$`));
  });

  test("an inflected form with several lemmas leads to the reader", async ({ page }) => {
    await page.goto(path("πόλεις"));
    await expect(page).toHaveURL(/\/lecteur\?q=.*&forme=/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("πόλεις");
  });

  test("an unknown form, or not a Greek word: not found", async ({ page }) => {
    expect((await page.goto(path("ξξξξ")))?.status()).toBe(404);
    expect((await page.goto("/q=logos"))?.status()).toBe(404);
  });
});
