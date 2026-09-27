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

  test("links after the entry: on desktop, only after a long definition", async ({ page, goto }) => {
    const surround = page.getByRole("navigation", { name: "Entrées voisines" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/logotechnês", { waitUntil: "hydration" });
    await expect(surround).toBeHidden();
    await goto("/logos", { waitUntil: "hydration" });
    await expect(surround).toBeVisible();

    await page.setViewportSize({ width: 390, height: 800 });
    await goto("/logotechnês", { waitUntil: "hydration" });
    await expect(surround).toBeVisible();
  });

  test("homonyms: each has its anchor", async ({ page, goto }) => {
    await goto("/logades#2", { waitUntil: "hydration" });
    await expect(page.locator("[id='1']")).toHaveCount(1);
    await expect(page.locator("[id='2']")).toHaveCount(1);
  });

  test("the title and the neighbours' links stick under the header", async ({ page, goto }) => {
    const bottom = (selector: string) => page.locator(selector).first().evaluate(element => Math.round(element.getBoundingClientRect().bottom));
    const top = (selector: string) => page.locator(selector).first().evaluate(element => Math.round(element.getBoundingClientRect().top));
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 700 });
      await goto("/logos", { waitUntil: "hydration" });
      await page.mouse.wheel(0, 1500);
      await expect.poll(() => top("main article > header")).toBe(await bottom("body > div header"));
      await expect(page.locator("main h1")).toBeInViewport();
      // A line under it once stuck (scroll-state queries, supported by Chromium).
      await expect(page.locator("main article > header > nav")).not.toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
    }
  });

  test("the arrow of a definition sits in the line of its text", async ({ page, goto }) => {
    await goto("/chliainô", { waitUntil: "hydration" });
    const [arrow, text] = await page.locator("main .fleche").first().evaluate((element) => {
      const box = (node: Element) => node.getBoundingClientRect();
      return [box(element.querySelector(".flechea")!), box(element.querySelector(".ital")!)];
    });
    // Centered on the text (within a few pixels), not hanging below it.
    expect(arrow.bottom).toBeLessThanOrEqual(text.bottom);
    expect(Math.abs((arrow.top + arrow.bottom) / 2 - (text.top + text.bottom) / 2)).toBeLessThan(4);
  });
});
