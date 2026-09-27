import { expect, test } from "@nuxt/test-utils/playwright";
import type { Locator } from "@playwright/test";
import { resultsExtent, searchInput, searchResults, xExtent } from "./helpers";

/**
 * The highlight shown behind a result (its `::before` background).
 */
const highlight = (option: Locator) => option.evaluate(element => getComputedStyle(element, "::before").backgroundColor);

test.describe("search bar", () => {
  test.beforeEach(async ({ goto }) => {
    await goto("/", { waitUntil: "hydration" });
  });

  test("converts beta code to Greek, diacritics waiting for their letter", async ({ page }) => {
    const input = searchInput(page);
    await input.click();
    await input.pressSequentially("a)nh/r");
    await expect(input).toHaveValue("ἀνήρ");
    await input.fill("");
    // Before a capital, the diacritic waits for its letter.
    await input.pressSequentially("*)");
    await expect(input).toHaveValue("*᾿");
    await input.pressSequentially("aqh=nai");
    await expect(input).toHaveValue("Ἀθῆναι");
  });

  test("shows grouped results and their count", async ({ page }) => {
    await searchInput(page).fill("logos");
    await expect(searchInput(page)).toHaveValue("λογος");
    const results = searchResults(page);
    await expect(results.getByText("Correspondances exactes")).toBeVisible();
    await expect(results.getByRole("option").filter({ hasText: "λόγος" }).first()).toBeVisible();
    await expect(page.locator("header [data-slot=trailing]")).toHaveText(/\d+/);
  });

  test("lists the results exactly as wide as the bar", async ({ page }) => {
    await searchInput(page).fill("log");
    await expect(searchResults(page)).toBeVisible();
    const bar = await xExtent(page, "header .group\\/search");
    const list = await resultsExtent(page);
    expect(Math.abs(list[0] - bar[0])).toBeLessThan(1);
    expect(Math.abs(list[1] - bar[1])).toBeLessThan(1);
  });

  test("replaces the magnifier with a clear button", async ({ page }) => {
    const clear = page.getByRole("button", { name: /Effacer/ });
    await expect(clear).toHaveCount(0);
    await searchInput(page).fill("logos");
    await clear.click();
    await expect(searchInput(page)).toHaveValue("");
    await expect(clear).toHaveCount(0);
  });

  test("shows a loading indicator only when the API is slow", async ({ page }) => {
    let delay = 0;
    await page.route("**/lookup/**", async (route) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
    const spinner = page.locator("header [data-slot=trailing] .animate-spin");
    await searchInput(page).fill("log");
    await expect(page.locator("header [data-slot=trailing]")).toHaveText(/\d+/);
    delay = 1500;
    await searchInput(page).fill("logos");
    await page.waitForTimeout(250);
    await expect(spinner).toHaveCount(0);
    await expect(spinner).toHaveCount(1);
    await expect(spinner).toHaveCount(0, { timeout: 3000 });
  });

  test("closes on Escape and reopens on focus", async ({ page }) => {
    const input = searchInput(page);
    await input.fill("logos");
    await expect(searchResults(page)).toBeVisible();
    await input.press("Escape");
    await expect(searchResults(page)).toBeHidden();
    await input.click();
    await expect(searchResults(page)).toBeVisible();
  });

  test.describe("Enter", () => {
    test("opens the only exact match", async ({ page }) => {
      await searchInput(page).fill("logos");
      await expect(searchResults(page)).toBeVisible();
      await searchInput(page).press("Enter");
      await expect(page).toHaveURL(/\/logos$/);
      await expect(page.locator("main h1")).toHaveText("λόγος");
      await expect(searchResults(page)).toBeHidden();
    });

    test("highlights the first result without an exact match, then opens it", async ({ page }) => {
      await searchInput(page).fill("log");
      const first = searchResults(page).getByRole("option").first();
      await expect(first).toBeVisible();
      // The first result is highlighted by the list, but only shown once chosen.
      await expect.poll(() => highlight(first)).toBe("rgba(0, 0, 0, 0)");
      await searchInput(page).press("Enter");
      await expect.poll(() => highlight(first)).not.toBe("rgba(0, 0, 0, 0)");
      await searchInput(page).press("Enter");
      await expect(page).not.toHaveURL(/\/$/);
    });

    test("the first arrow press shows the first result", async ({ page }) => {
      await searchInput(page).fill("log");
      const first = searchResults(page).getByRole("option").first();
      await expect(first).toBeVisible();
      await searchInput(page).press("ArrowDown");
      await expect(first).toHaveAttribute("data-highlighted");
      await expect.poll(() => highlight(first)).not.toBe("rgba(0, 0, 0, 0)");
    });
  });
});

test.describe("search options", () => {
  test.beforeEach(async ({ goto }) => {
    await goto("/", { waitUntil: "hydration" });
  });

  const options = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Options de recherche" });

  test("position: a reminder above the results, and a reset", async ({ page }) => {
    await options(page).click();
    await page.getByText("Fin", { exact: true }).click();
    await page.keyboard.press("Escape");
    await searchInput(page).fill("logos");
    // The reminder sits above the results, in the same popup.
    await expect(page.getByText("Entrées finissant par « λογος »")).toBeVisible();
    await page.getByText("Entrées finissant par « λογος »").locator("..").getByRole("button", { name: "Réinitialiser" }).click();
    await expect(page.getByText(/Entrées finissant par/)).toHaveCount(0);
  });

  test("wildcards: kept as typed, inflected forms not applicable", async ({ page }) => {
    await searchInput(page).fill("l?gos");
    await expect(searchInput(page)).toHaveValue("λ?γος");
    await options(page).click();
    await expect(page.getByText("Formes fléchies (sans objet)")).toBeVisible();
  });

  test("input mode: transliteration, remembered", async ({ page, goto }) => {
    await options(page).click();
    await page.getByText("Translittération", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(searchInput(page)).toHaveAttribute("placeholder", "anazētéō…");
    await goto("/", { waitUntil: "hydration" });
    await expect(searchInput(page)).toHaveAttribute("placeholder", "anazētéō…");
  });
});

test("the pointer on the results, as on the history's links and the buttons", async ({ page, goto }) => {
  await goto("/logos", { waitUntil: "hydration" });
  await expect(page.getByRole("button", { name: "Entrées consultées récemment" })).toHaveCSS("cursor", "pointer");
  await searchInput(page).fill("logos");
  await expect(searchResults(page).getByRole("option").first()).toHaveCSS("cursor", "pointer");
});

test("no results panel while there is nothing to look up", async ({ page, goto }) => {
  await goto("/", { waitUntil: "hydration" });
  await searchInput(page).pressSequentially("log");
  await expect(searchResults(page)).toBeVisible();
  await searchInput(page).fill("");
  await expect(searchResults(page)).toBeHidden();
  // A lone capital mark (beta code) waits for its letter.
  await searchInput(page).pressSequentially("*");
  await expect(searchResults(page)).toBeHidden();
  await searchInput(page).pressSequentially("l");
  await expect(searchResults(page)).toBeVisible();
});
