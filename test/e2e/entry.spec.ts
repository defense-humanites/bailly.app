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

  test("homonyms: each has its anchor, and its number after its headword", async ({ page, goto }) => {
    await goto("/logades#2", { waitUntil: "hydration" });
    await expect(page.locator("[id='1']")).toHaveCount(1);
    await expect(page.locator("[id='2']")).toHaveCount(1);
    await expect(page.locator(".definition .entreea")).toHaveText(["λογάδες1,", "λογάδες2,"]);
  });

  test("homonyms: the address follows the one being read", async ({ page, goto }) => {
    // A short window, for this short entry to scroll.
    await page.setViewportSize({ width: 1280, height: 300 });
    await goto("/logades", { waitUntil: "hydration" });
    // The top of a homonym, or of its last sense, brought just above the
    // reading line.
    const scrollTo = (index: number, sense = false) => page.evaluate(([index, sense]) => {
      const definition = document.querySelectorAll(".definition")[index]!;
      const element = sense ? [...definition.querySelectorAll(".pp")].at(-1)! : definition;
      document.querySelector("main")!.scrollBy({ top: element.getBoundingClientRect().top - innerHeight / 4 + 10, behavior: "instant" });
    }, [index, sense] as const);
    // The second one, short, at the page's bottom.
    await scrollTo(1);
    await expect(page).toHaveURL(/\/logades#2$/);
    await scrollTo(0, true);
    await expect(page).toHaveURL(/\/logades#1$/);
    // Back at the top: none.
    await page.evaluate(() => {
      document.querySelector("main")!.scrollTo({ top: 0, behavior: "instant" });
    });
    await expect(page).toHaveURL(/\/logades$/);
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

  test("the compact bar shows the path to the sense being read", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const bar = page.getByRole("navigation", { name: "Navigation de l'entrée" });
    // A sense within a section within a part (scrolled to first, for the bar
    // to appear), then brought right above the reading line (a quarter down
    // the window, not higher than the bar's bottom edge); the path follows
    // once the scroll has stopped.
    const expected = await page.evaluate(() => {
      const sense = document.querySelector(".definition .Rub .rub .pp")!;
      const numbers = [sense.closest(".Rub")!, sense.closest(".rub")!, sense].map(element => element.querySelector(":scope > :is(.Ruba, .ruba, .ppa)")!.textContent.trim());
      const main = document.querySelector("main")!;
      main.scrollBy({ top: sense.getBoundingClientRect().top - 150, behavior: "instant" });
      return numbers.map(number => `${number}.`).join(" › ");
    });
    await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const sense = document.querySelector(".definition .Rub .rub .pp")!;
      const barBottom = document.querySelector("nav[aria-label='Navigation de l\\'entrée']")!.getBoundingClientRect().bottom;
      main.scrollBy({ top: sense.getBoundingClientRect().top - Math.max(barBottom, innerHeight / 4) + 2, behavior: "instant" });
    });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(new RegExp(`λόγος\\s· ${expected.replace(/\./g, "\\.")} \\p{L}`, "u"));

    // In the definition's head, before its first sense: the word alone.
    await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const head = document.querySelector(".definition .entreea")!;
      const barBottom = document.querySelector("nav[aria-label='Navigation de l\\'entrée']")!.getBoundingClientRect().bottom;
      main.scrollBy({ top: head.getBoundingClientRect().top - Math.max(barBottom, innerHeight / 4) + 2, behavior: "instant" });
    });
    await expect(bar).toBeVisible();
    await expect(bar).not.toContainText("·");
  });

  test("an outline only if a section starts out of the first screen", async ({ page, goto }) => {
    const outline = page.getByRole("navigation", { name: "Sommaire de l'entrée" });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Three senses, the third one below the window: an outline.
    await goto(encodeURI("/thnêskô"), { waitUntil: "hydration" });
    await expect(outline).toBeVisible();
    // Several sections, all in view at once: none.
    await goto(encodeURI("/plektanê"), { waitUntil: "hydration" });
    await expect(page.locator(".definition .rub").first()).toBeVisible();
    await expect(outline).toHaveCount(0);
    // The window made much shorter, its last sections now below it: one,
    // without reloading the page.
    await page.setViewportSize({ width: 1440, height: 420 });
    await expect(outline).toBeVisible();
  });

  test("a long entry's outline: beside the card from xl, from the compact bar below", async ({ page, goto }) => {
    const bar = page.getByRole("navigation", { name: "Navigation de l'entrée" });
    const outline = page.getByRole("navigation", { name: "Sommaire de l'entrée" });

    await page.setViewportSize({ width: 1440, height: 900 });
    await goto("/logos", { waitUntil: "hydration" });
    await expect(outline).toBeVisible();
    // Titled, as the privacy page's column.
    await expect(page.locator("aside").getByText("Sommaire", { exact: true })).toBeVisible();
    const part = outline.getByRole("button", { name: /^B\./ }).first();
    // Hovered, the item tints its sense in the text; no longer once left.
    const sense = page.locator(".definition .Rub").nth(1);
    await part.hover();
    await expect(sense).toHaveAttribute("data-outline-preview");
    await page.mouse.move(10, 10);
    await expect(sense).not.toHaveAttribute("data-outline-preview");
    const { x, y, width, height } = (await part.boundingBox())!;
    await part.click();
    // Not tinted again while the cursor stays on the item chosen (checked
    // at once: the outline then unfolds the part, moving the item).
    await page.mouse.move(x + width / 2 + 4, y + height / 2);
    expect(await sense.getAttribute("data-outline-preview")).toBeNull();
    // The part brought into view, then marked as the one being read, and
    // outlined for a moment.
    await expect(part).toHaveAttribute("aria-current", "location");
    await expect(bar).toContainText(/λόγος\s· B\./);
    await expect(sense).toHaveAttribute("data-card-highlight");
    await expect(sense).not.toHaveAttribute("data-card-highlight");
    // Chosen again, then another item hovered: one sense singled out at a
    // time, the chosen one fading at once.
    await part.click();
    await expect(sense).toHaveAttribute("data-card-highlight");
    await outline.getByRole("button", { name: /^A\./ }).first().hover();
    await expect(page.locator(".definition .Rub").first()).toHaveAttribute("data-outline-preview");
    await expect(sense).not.toHaveAttribute("data-card-highlight", { timeout: 600 });

    await page.setViewportSize({ width: 390, height: 844 });
    await goto("/logos", { waitUntil: "hydration" });
    await expect(outline).toBeHidden();
    await page.evaluate(() => {
      document.querySelector("main")!.scrollBy({ top: 1500, behavior: "instant" });
    });
    await bar.getByRole("button", { name: "Sommaire de l'entrée" }).click();
    await expect(outline).toBeVisible();
    await outline.getByRole("button", { name: /^B\./ }).first().click();
    await expect(outline).toBeHidden();
    await expect(bar).toContainText(/λόγος\s· B\./);
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
