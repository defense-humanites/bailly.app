import { expect, test } from "@nuxt/test-utils/playwright";
import { FEATURES } from "../../shared/utils/features";
import type { Locator } from "@playwright/test";
import { searchInput } from "./helpers";

test.describe("home page", () => {
  test("opens the dictionary at random: an entry between its neighbors", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    // The fake API always draws the same (recorded) entry.
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte\s: /);
    await expect(opening.locator(".definition")).toBeVisible();
    const previous = opening.getByRole("link", { name: /^Entrée précédente\s: / });
    const next = opening.getByRole("link", { name: /^Entrée suivante\s: / });
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();

    // Another draw, without reloading the page: the entry and its neighbors
    // in a single request.
    const requests: string[] = [];
    page.on("request", request => request.url().includes("/entry/") && requests.push(request.url()));
    await opening.getByRole("button", { name: "Ouvrir à une autre page" }).click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toContain("/entry/random");
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte\s: /);

    // A neighbor leads to its page.
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("serves the random entry with the page, draws the next ones in the browser", async ({ page, goto }) => {
    // Rendered by the server: in the page's HTML.
    const html = await page.request.get("/").then(response => response.text());
    expect(html).toMatch(/data-random-opening[^]*class="definition/);

    const requests: string[] = [];
    page.on("request", request => request.url().includes("/entry/random") && requests.push(request.url()));
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await expect(opening.locator(".definition")).toBeVisible();
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte\s: /);
    // Neither a preload nor a request of the browser.
    await expect(page.locator("link[rel=preload][as=fetch]")).toHaveCount(0);
    expect(requests).toHaveLength(0);

    // Another draw: in the browser.
    await opening.getByRole("button", { name: "Ouvrir à une autre page" }).click();
    await expect.poll(() => requests.length).toBe(1);

    // Back to the page within the application: another one, in the browser.
    await page.getByRole("link", { name: "Signets" }).first().click();
    await expect(page).toHaveURL(/signets$/);
    await page.goBack();
    await expect.poll(() => requests.length).toBe(2);
    await expect(opening.locator(".definition")).toBeVisible();

    // Reloaded: served again with the page.
    await page.reload();
    await expect(opening.locator(".definition")).toBeVisible();
    expect(requests).toHaveLength(2);
  });

  // The style sheet and the fonts first (cf. `server/plugins/modulePreloads.ts`).
  test("preloads its scripts at a low priority", async ({ page }) => {
    const html = await page.request.get("/").then(response => response.text());
    const preloads = html.match(/<link rel="modulepreload"[^>]*>/g) ?? [];
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.every(link => link.includes("fetchpriority=\"low\""))).toBe(true);
  });

  test("gives the focus to the search field on opening, but not on a touch screen", async ({ page, goto, browser }) => {
    await goto("/", { waitUntil: "hydration" });
    await expect(searchInput(page)).toBeFocused();

    const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, baseURL: page.url() });
    const mobile = await touch.newPage();
    await mobile.goto("/");
    await expect(mobile.getByRole("region", { name: "Le Bailly ouvert au hasard" }).getByRole("status")).toHaveText(/^Entrée ouverte\s: /);
    await expect(searchInput(mobile)).not.toBeFocused();
    await touch.close();
  });

  test("leaves the focus where it is when the search field holds a search", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await searchInput(page).fill("logos");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "À propos", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/à-propos")}$`));
    // The header hidden on the cover until the pointer comes back to it.
    const logo = page.getByRole("link", { name: "Bailly.app" });
    const box = (await logo.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, 400);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(searchInput(page)).toHaveValue("λογος");
    await expect(searchInput(page)).not.toBeFocused();
  });

  test("offers the transliteration to those who don't read Greek, saved at once", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte\s: /);
    const word = opening.locator(".definition").first();
    await expect(word).toContainText(/\p{Script=Greek}/u);

    await page.getByRole("switch", { name: "Vous ne lisez pas le grec ?" }).click();
    await expect(word).not.toContainText(/\p{Script=Greek}/u);
    const cookies = await page.context().cookies();
    expect(decodeURIComponent(cookies.find(cookie => cookie.name === "bailly-preferences")?.value ?? "")).toContain("\"transliterateGreek\":true");
  });

  test("a tip drawn at random, its action tried; not the same next time", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Drawn as the third of the tips (beta code, with a fine pointer).
    await page.addInitScript(() => {
      Math.random = () => 0.3;
    });
    await goto("/", { waitUntil: "hydration" });
    const tip = page.getByText("Tapez le grec en beta code");
    await expect(tip).toBeVisible();
    // Typed in the search field, converted, its results shown.
    await page.getByRole("button", { name: "Rechercher « lo/gos »" }).click();
    await expect(searchInput(page)).toHaveValue("λόγος");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Une forme fléchie mène à son lemme")).toBeVisible();
    await expect(tip).toHaveCount(0);
  });

  test("a tip's search is typed letter by letter, its results shown once typed", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Drawn as the third of the tips (beta code, with a fine pointer).
    await page.addInitScript(() => {
      Math.random = () => 0.3;
    });
    await goto("/", { waitUntil: "hydration" });
    const steps = page.evaluate(() => new Promise<{ value: string; panel: boolean }[]>((resolve) => {
      const input = document.querySelector<HTMLInputElement>(".search-bar input")!;
      const seen: { value: string; panel: boolean }[] = [];
      const tick = (): void => {
        const step = { value: input.value, panel: document.querySelector("[data-search-results]") !== null };
        const last = seen.at(-1);
        if (step.value && (last?.value !== step.value || last.panel !== step.panel)) seen.push(step);
        if (step.panel) resolve(seen);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    await page.getByRole("button", { name: "Rechercher « lo/gos »" }).click();
    // Each keystroke converted (`lo/` shows « λό »), the results with the last.
    expect((await steps).map(({ value }) => value)).toEqual(["λ", "λο", "λό", "λόγ", "λόγο", "λόγος"]);
    expect((await steps).filter(({ panel }) => panel).map(({ value }) => value)).toEqual(["λόγος"]);
  });

  test("a tip's search typed: a key ends it, the whole text then shown; at once with reduced motion", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      Math.random = () => 0.3;
    });
    await goto("/", { waitUntil: "hydration" });
    const tip = page.getByRole("button", { name: "Rechercher « lo/gos »" });
    await tip.click();
    await page.keyboard.press("End");
    expect(await searchInput(page).inputValue()).toBe("λόγος");
    await expect(page.getByRole("listbox")).toBeVisible();

    await page.keyboard.press("Escape");
    await searchInput(page).fill("");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await tip.click();
    expect(await searchInput(page).inputValue()).toBe("λόγος");
  });

  test("the citation's tip points out the random entry's citation button, then opens it", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Drawn as the first of the tips.
    await page.addInitScript(() => {
      Math.random = () => 0.01;
      // The citation's window last left on the LaTeX tab.
      localStorage.setItem("bailly:citationTab", "bib");
    });
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await expect(opening.locator(".definition")).toBeVisible();
    await page.getByRole("button", { name: "Citer", exact: true }).first().click();
    await expect(opening.locator("[data-citation]")).toHaveAttribute("data-card-highlight", "");
    // Then its window opened, on the word processor's tab, the focus back on
    // it once closed.
    const dialog = page.getByRole("dialog", { name: "Citer", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Traitement de texte" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(opening.getByRole("button", { name: "Citer", exact: true })).toBeFocused();
  });

  for (const { name, draw, action, target } of [
    { name: "the fonts' tip points out the reading's card", draw: 8.5 / 9, action: "Préférences", target: (card: Locator) => card.locator("#settings-reading") },
    { name: "the synchronization's tip points out its button", draw: 6.5 / 9, action: "Synchroniser", target: (card: Locator) => card.getByRole("button", { name: /^Synchronisation/ }) },
  ]) {
    test(name, async ({ page, goto }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript((draw) => {
        Math.random = () => draw;
      }, draw);
      await goto("/", { waitUntil: "hydration" });
      await page.locator("main").getByRole("link", { name: action, exact: true }).click();
      const highlighted = page.locator("[data-card-highlight]");
      await expect(highlighted).toHaveCount(1);
      await expect(target(highlighted)).toHaveCount(1);
    });
  }

  test("names the edition in a popover, after the title", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    // The heading is named after its text only.
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Consultez le dictionnaire grec-français d'Anatole Bailly");
    const button = page.getByRole("button", { name: "L'édition du texte" });
    const edition = page.getByText("que ses auteurs ont intitulée");
    // Hovered with a mouse: the popover opens, the focus stays where it was.
    await button.hover();
    await expect(edition).toBeVisible();
    await expect(page.getByRole("link", { name: "En savoir plus", exact: true })).not.toBeFocused();
    await page.mouse.move(0, 0);
    await expect(edition).toBeHidden();
    // Clicked: it opens too.
    await button.click();
    await expect(edition).toBeVisible();
  });

  test("the features not offered yet: no links, their pages not served", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    if (!FEATURES.news) await expect(page.getByRole("link", { name: "Nouveautés" })).toHaveCount(0);
    if (!FEATURES.donations) await expect(page.getByRole("link", { name: /Nous soutenir/ })).toHaveCount(0);
    for (const [on, path] of [[FEATURES.news, "/nouveautés"], [FEATURES.donations, "/soutenir"], [FEATURES.donations, "/soutenir/merci"]] as const) {
      if (on) continue;
      await goto(encodeURI(path), { waitUntil: "hydration" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
    }
  });

  test("leads to the about page", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("link", { name: "en savoir plus", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/à-propos")}$`));
  });

  test("leads to the news: a button, on mobile the header's cotillons", async ({ page, goto }) => {
    test.skip(!FEATURES.news, "The news are not offered yet (cf. `FEATURES`).");
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("link", { name: "Nouveautés" }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/nouveautés")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Une nouvelle application Bailly");
    // Their icon only in the header, on the home page only.
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.locator("header").getByRole("link", { name: "Nouveautés" })).toBeHidden();
    await goto("/", { waitUntil: "hydration" });
    const news = page.locator("header").getByRole("link", { name: "Nouveautés" });
    await expect(news).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Nouveautés" })).toBeHidden();
    await news.click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/nouveautés")}$`));
  });
});
