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

  test("links after the entry, on every screen", async ({ page, goto }) => {
    const surround = page.getByRole("navigation", { name: "Entrées voisines" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/logotechnês", { waitUntil: "hydration" });
    await expect(surround).toBeVisible();
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

  test("a compact bar appears once the title is out of sight", async ({ page, goto }) => {
    const bar = page.getByRole("navigation", { name: "Navigation de l'entrée" });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 700 });
      await goto("/logos", { waitUntil: "hydration" });
      await expect(bar).toBeHidden();
      await page.mouse.move(200, 400);
      await page.mouse.wheel(0, 1500);
      await expect(bar).toBeVisible();
      await expect(bar).toContainText("λόγος");
      // Right under the header.
      const [barTop, headerBottom] = await page.evaluate(async () => {
        const nav = document.querySelector("nav[aria-label='Navigation de l\\'entrée']")!;
        await Promise.all(nav.getAnimations().map(animation => animation.finished));
        return [nav.getBoundingClientRect().top, document.querySelector("body > div header")!.getBoundingClientRect().bottom];
      });
      expect(Math.abs(barTop - headerBottom)).toBeLessThan(1);
      // Exactly as wide as the definition's card.
      const [barX, cardX] = await page.evaluate(() => [
        document.querySelector("nav[aria-label='Navigation de l\\'entrée']")!,
        document.querySelector("main article section [data-slot=root]")!,
      ].map(element => [Math.round(element.getBoundingClientRect().left), Math.round(element.getBoundingClientRect().right)]));
      expect(barX).toEqual(cardX);
      await page.mouse.move(200, 400);
      await page.mouse.wheel(0, -3000);
      await expect(bar).toBeHidden();
    }
  });

  test("keyboard: the arrows lead to the neighbouring entries", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const nextWord = (await page.locator("article > header").getByRole("link", { name: /^Entrée suivante : / }).getAttribute("aria-label"))!.replace("Entrée suivante : ", "");
    // Not while typing in the search bar.
    await page.locator("header input[role=combobox]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("main h1")).toHaveText("λόγος");
    // Nor on a link (e.g. of the definition).
    await page.locator("main .definition a").first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("main h1")).toHaveText("λόγος");
    await page.locator("main h1").click();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("main h1")).toHaveText(nextWord);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("main h1")).toHaveText("λόγος");
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

// Until the page is interactive, the toolbar's markup alone (cf.
// `TagButtonGroupStatic`): the page's scripts are held back to reach it.
test("the entry's toolbar, the same before the page is interactive", async ({ page }) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_nuxt\/.+\.js$/, async (route) => {
    await released;
    await route.continue();
  });
  await page.goto("/logos", { waitUntil: "commit" });
  const toolbar = page.locator("main article section [aria-label='Toutes les étiquettes']").locator("..");
  await expect(toolbar).toBeVisible();
  const boxes = () => toolbar.evaluate(group => [group, ...group.children].map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { x, y, width, height, background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, shadow: style.boxShadow };
  }));
  const before = await boxes();
  release();
  await expect(page.locator("main article section button[aria-haspopup=dialog]")).toBeVisible();
  expect(await boxes()).toEqual(before);
});
