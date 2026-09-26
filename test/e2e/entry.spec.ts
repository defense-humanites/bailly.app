import { expect, test } from "@nuxt/test-utils/playwright";

test.describe("entry page", () => {
  test("title, without background", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const title = page.locator("main h1");
    await expect(title).toHaveText("λόγος");
    const background = await title.evaluate(element => getComputedStyle(element, "::before").backgroundColor);
    expect(background).toBe("rgba(0, 0, 0, 0)");
  });

  test.describe("links to the neighbouring entries", () => {
    const previous = (page: import("@playwright/test").Page) => page.locator("article > header").getByRole("link", { name: /^Entrée précédente : / });
    const next = (page: import("@playwright/test").Page) => page.locator("article > header").getByRole("link", { name: /^Entrée suivante : / });

    test("arrows only below sm", async ({ page, goto }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await goto("/logos", { waitUntil: "hydration" });
      await expect(previous(page).locator("[data-slot=linkLabel]")).toHaveClass(/sr-only/);
      await expect(next(page).locator("[data-slot=linkLabel]")).toHaveClass(/sr-only/);
    });

    test("arrows and words from sm", async ({ page, goto }) => {
      await page.setViewportSize({ width: 1024, height: 800 });
      await goto("/logos", { waitUntil: "hydration" });
      await expect(previous(page).locator("[data-slot=linkLabel]")).toBeVisible();
      await expect(next(page).locator("[data-slot=linkLabel]")).toBeVisible();
    });

    test("after the entry, with the whole words, leading to them", async ({ page, goto }) => {
      await goto("/logos", { waitUntil: "hydration" });
      const surround = page.getByRole("navigation", { name: "Entrées voisines" });
      await expect(surround.getByRole("link")).toHaveCount(2);
      const nextWord = (await next(page).getAttribute("aria-label"))!.replace("Entrée suivante : ", "");
      await surround.getByRole("link").last().click();
      await expect(page.locator("main h1")).toHaveText(nextWord);
    });
  });

  test("homonyms: each has its anchor", async ({ page, goto }) => {
    await goto("/logades#2", { waitUntil: "hydration" });
    await expect(page.locator("[id='1']")).toHaveCount(1);
    await expect(page.locator("[id='2']")).toHaveCount(1);
  });
});
