import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { resultsExtent, searchInput, searchResults, xExtent } from "./helpers";

/**
 * The header's inner box (from `md`: inside the floating header's border and
 * padding) and the centers of its items.
 */
const header = (page: Page) => page.evaluate(() => {
  const nav = document.querySelector("header > nav")!;
  const style = getComputedStyle(nav);
  const box = nav.getBoundingClientRect();
  const inner = {
    left: box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
    right: box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
    center: (box.top + box.bottom) / 2,
  };
  const [title, menu] = [...nav.querySelectorAll(":scope > nav")].map(n => n.querySelectorAll("a"));
  const rect = (element: Element) => element.getBoundingClientRect();
  const bar = rect(nav.querySelector(".group\\/search")!);
  return {
    inner,
    title: rect(title![0]!),
    lastMenuLink: rect(menu![menu!.length - 1]!),
    bar,
    scroll: document.documentElement.scrollWidth - innerWidth,
  };
});

for (const width of [320, 390, 768, 1024, 1279, 1280, 1440, 1920]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("header: aligned edges, centered row, no horizontal scroll", async ({ page, goto }) => {
      await goto("/logos", { waitUntil: "hydration" });
      const h = await header(page);
      expect(h.scroll).toBe(0);
      if (width < 768) {
        // The title and the last menu link line up with the search bar.
        expect(Math.abs(h.title.left - h.bar.left)).toBeLessThan(1);
        expect(Math.abs(h.lastMenuLink.right - h.bar.right)).toBeLessThan(1);
      } else {
        expect(Math.abs(h.title.left - h.inner.left)).toBeLessThan(1);
        expect(Math.abs(h.lastMenuLink.right - h.inner.right)).toBeLessThan(1);
        for (const item of [h.title, h.lastMenuLink, h.bar]) {
          expect(Math.abs((item.top + item.bottom) / 2 - h.inner.center)).toBeLessThan(1);
        }
      }
    });

    test("entry column: centered, then under the search bar", async ({ page, goto }) => {
      await goto("/logos", { waitUntil: "hydration" });
      const bar = await xExtent(page, "header .group\\/search");
      const column = await xExtent(page, "main > div > div");
      if (width < 768) {
        expect(Math.abs((column[0] + column[1]) / 2 - width / 2)).toBeLessThan(1);
      } else {
        expect(Math.abs(column[0] - bar[0])).toBeLessThan(1);
        if (width >= 1280) expect(Math.abs(column[1] - bar[1])).toBeLessThan(1);
        else expect(column[1] - column[0]).toBeLessThanOrEqual(640.5);
      }
    });
  });
}

test.describe("header menu", () => {
  test("icons only below xl, with tooltips", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await goto("/logos", { waitUntil: "hydration" });
    const link = page.getByRole("link", { name: "Signets" });
    await expect(link.locator("[data-slot=linkLabel]")).toHaveClass(/sr-only/);
    await link.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Signets");
  });

  test("icons and labels from xl, without tooltips", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await goto("/logos", { waitUntil: "hydration" });
    const link = page.getByRole("link", { name: "Signets" });
    await expect(link.locator("[data-slot=linkLabel]")).toBeVisible();
    await link.hover();
    await page.waitForTimeout(800);
    await expect(page.locator("[role=tooltip]")).toHaveCount(0);
  });

  test("the title is never shown as active", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await expect(page.getByRole("link", { name: "Bailly.app" })).not.toHaveAttribute("aria-current", "page");
  });
});

test("the application is at least 20rem wide", async ({ page, goto }) => {
  await page.setViewportSize({ width: 300, height: 700 });
  await goto("/logos", { waitUntil: "hydration" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThanOrEqual(320);
});

test("the results list stays as wide as the bar on mobile", async ({ page, goto }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await goto("/", { waitUntil: "hydration" });
  await searchInput(page).fill("log");
  await expect(searchResults(page)).toBeVisible();
  const bar = await xExtent(page, "header .group\\/search");
  const content = await resultsExtent(page);
  expect(Math.abs(content[0] - bar[0])).toBeLessThan(1);
  expect(Math.abs(content[1] - bar[1])).toBeLessThan(1);
});

test.describe("safe areas", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "The safe area insets are emulated through Chromium (CDP).");

  test("a landscape notch: the header and the column clear it, still aligned", async ({ page, goto, context }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 21, left: 47, right: 47 } });
    await goto("/logos", { waitUntil: "hydration" });
    const h = await header(page);
    expect(h.scroll).toBe(0);
    expect(h.title.left).toBeGreaterThanOrEqual(47 + 24);
    expect(h.lastMenuLink.right).toBeLessThanOrEqual(844 - 47 - 24);
    const bar = await xExtent(page, "header .group\\/search");
    const column = await xExtent(page, "main > div > div");
    expect(Math.abs(column[0] - bar[0])).toBeLessThan(1);
    const paddingBottom = await page.locator("main").evaluate(element => getComputedStyle(element).paddingBottom);
    expect(paddingBottom).toBe(`${24 + 21}px`);
  });
});
