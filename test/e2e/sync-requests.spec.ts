import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole" };

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

/**
 * The most requests made within a window of `span` ms.
 */
const busiestWindow = (times: number[], span: number): number =>
  Math.max(0, ...times.map(start => times.filter(time => time >= start && time < start + span).length));

// The rate limiting rule of Cloudflare on `/api/sync/*` allows 30 requests in
// 10 s from an address: a reader opening and browsing several tabs, each page
// loaded in full (e.g. an installed application), must stay well below.
test("an active reader with several tabs makes few requests of synchronization", async ({ page, goto, baseURL }) => {
  test.setTimeout(120_000);
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });
  await page.getByRole("button", { name: /^Synchronisation/ }).click();
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Synchronisation activée sur cet appareil.", { exact: true })).toBeVisible();

  const context = page.context();
  const requests: { time: number; method: string }[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/sync/")) requests.push({ time: Date.now(), method: request.method() });
  });
  const started = Date.now();

  // Four tabs opened at once, then read in turn, each page loaded in full.
  const paths = ["/logos", "/logotechnês", "/logades", "/anêr", "/"];
  const tabs = [page, ...await Promise.all([1, 2, 3].map(() => context.newPage()))];
  await Promise.all(tabs.map(async (tab, i) => {
    await tab.goto(new URL(paths[i]!, baseURL).href);
    await waitForHydration(tab);
  }));
  for (let round = 1; round <= 6; round++) {
    for (const [i, tab] of tabs.entries()) {
      await tab.bringToFront();
      await tab.goto(new URL(paths[(i + round) % paths.length]!, baseURL).href);
      await waitForHydration(tab);
      await tab.waitForTimeout(1_000); // Reading.
    }
  }
  // Reading sends nothing: no change to send.
  expect(requests.filter(request => request.method === "PUT")).toEqual([]);

  // A change, in one of the tabs: sent once.
  await seedBookmarks(tabs[2]!, { starred: [logos] });
  await expect.poll(() => requests.filter(request => request.method === "PUT").length, { timeout: 15_000 }).toBe(1);

  const duration = Date.now() - started;
  const times = requests.map(request => request.time);
  // About one synchronization (a request, or two with a change) per 10 s for
  // all the tabs, instead of one per page loaded (28 here, in about 30 s).
  expect(busiestWindow(times, 10_000)).toBeLessThanOrEqual(5);
  expect(requests.length).toBeLessThanOrEqual(Math.ceil(duration / 10_000) * 2 + 2);
});
