import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { pageCenter, resultsExtent, rootLength, searchInput, searchResults, xExtent } from "./helpers";

/**
 * The header's inner box (inside its border and
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

for (const width of [320, 390, 768, 900, 1000, 1024, 1279, 1280, 1440, 1920]) {
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

    test("entry column: centered, under the search bar, which overhangs it evenly", async ({ page, goto }) => {
      await goto("/logos", { waitUntil: "hydration" });
      const bar = await xExtent(page, "header .group\\/search");
      const column = await xExtent(page, "main > div > div > div");
      // At most the reading width (37rem).
      expect(column[1] - column[0]).toBeLessThanOrEqual(592.5);
      if (width < 1024) {
        expect(Math.abs((column[0] + column[1]) / 2 - await pageCenter(page))).toBeLessThan(1);
      }
      // From md, the bar is centered above the column, overhanging it on
      // both sides once there is room for it (by 3rem at most).
      if (width >= 768) {
        expect(Math.abs((bar[0] + bar[1]) / 2 - (column[0] + column[1]) / 2)).toBeLessThan(1);
        if (width >= 1000) expect(bar[1] - bar[0]).toBeGreaterThan(column[1] - column[0]);
        expect(bar[1] - bar[0]).toBeLessThanOrEqual(688.5);
      }
    });
  });
}

test("the pages scroll under the header, not the window; back, at the same place", async ({ page, goto }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto("/logos", { waitUntil: "hydration" });
  const scroller = page.locator("#page");
  await scroller.evaluate((element) => {
    element.scrollTo(0, 800);
  });
  await page.evaluate(async () => {
    const app = (window as unknown as { useNuxtApp: () => { $router: { push: (path: string) => Promise<unknown> } } }).useNuxtApp();
    await app.$router.push("/logades");
  });
  await expect(page).toHaveURL(/\/logades$/);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/logos$/);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(800);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the header is anchored, its border shown once the page is scrolled", async ({ page, goto }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await goto("/logos", { waitUntil: "hydration" });
  const state = () => page.locator("body > div header").first().evaluate((element) => {
    const { top, left, right } = element.getBoundingClientRect();
    return { top, left, right, border: getComputedStyle(element).borderBottomColor };
  });
  const atTop = await state();
  expect(atTop).toMatchObject({ top: 0, left: 0, right: 1280 });
  expect(atTop.border).toBe("rgba(0, 0, 0, 0)");

  // Over the pages' scroller (the header doesn't scroll them).
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 400);
  await expect.poll(async () => (await state()).border).not.toBe("rgba(0, 0, 0, 0)");
  expect(await state()).toMatchObject({ top: 0, left: 0, right: 1280 });
});

test("from md, the search bar widens up to the reading width and its overhangs, and never narrows", async ({ page, goto }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await goto("/logos", { waitUntil: "hydration" });
  // Overlay scrollbars (phones, macOS), not this browser's classic ones: the
  // breakpoints, of the window's width, then fall where the header's does.
  await page.addStyleTag({ content: "#page, header { scrollbar-width: none; }" });
  const widest = await rootLength(page, "--reading-width") + 2 * await rootLength(page, "--search-overhang");
  let previous = 0;
  for (let width = 768; width <= 1920; width += 16) {
    await page.setViewportSize({ width, height: 800 });
    const [left, right] = await xExtent(page, "header .group\\/search");
    expect(right - left).toBeGreaterThanOrEqual(previous - 0.5);
    expect(right - left).toBeLessThanOrEqual(widest + 0.5);
    previous = right - left;
  }
  expect(previous).toBeCloseTo(widest, 0);
});

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

test("the audience measurement is loaded on the production host only", async ({ page, goto }) => {
  await goto("/", { waitUntil: "hydration" });
  await expect(page.locator("script[src*='simpleanalytics']")).toHaveCount(0);
});

test("the application is at least 20rem wide", async ({ page, goto }) => {
  await page.setViewportSize({ width: 300, height: 700 });
  await goto("/logos", { waitUntil: "hydration" });
  // The pages' scroller scrolls sideways (cf. `PageScroller`), its content
  // and its scrollbar's room 20rem wide.
  expect(await page.evaluate(() => {
    const scroller = document.getElementById("page")!;
    return scroller.scrollWidth + scroller.offsetWidth - scroller.clientWidth;
  })).toBeGreaterThanOrEqual(320);
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

  test("a landscape notch: the header and the column clear it, the column centered", async ({ page, goto, context }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 21, left: 47, right: 47 } });
    await goto("/logos", { waitUntil: "hydration" });
    const h = await header(page);
    expect(h.scroll).toBe(0);
    expect(h.title.left).toBeGreaterThanOrEqual(47 + 24);
    expect(h.lastMenuLink.right).toBeLessThanOrEqual(844 - 47 - 24);
    const column = await xExtent(page, "main > div > div > div");
    expect(column[0]).toBeGreaterThanOrEqual(47 + 24);
    expect(Math.abs((column[0] + column[1]) / 2 - await pageCenter(page))).toBeLessThan(1);
    const paddingBottom = await page.locator("main > div").first().evaluate(element => getComputedStyle(element).paddingBottom);
    expect(paddingBottom).toBe(`${24 + 21}px`);
  });
});
