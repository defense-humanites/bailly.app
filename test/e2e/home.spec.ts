import { expect, test } from "@nuxt/test-utils/playwright";
import { FEATURES } from "../../shared/utils/features";
import { searchInput } from "./helpers";

test.describe("home page", () => {
  test("opens the dictionary at random: an entry between its neighbors", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    // The fake API always draws the same (recorded) entry.
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte : /);
    await expect(opening.locator(".definition")).toBeVisible();
    const previous = opening.getByRole("link", { name: /^Entrée précédente : / });
    const next = opening.getByRole("link", { name: /^Entrée suivante : / });
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();

    // Another draw, without reloading the page: the entry and its neighbors
    // in a single request.
    const requests: string[] = [];
    page.on("request", request => request.url().includes("/entry/") && requests.push(request.url()));
    await opening.getByRole("button", { name: "Ouvrir à une autre page" }).click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toContain("/entry/random");
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte : /);

    // A neighbor leads to its page.
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("fetches the random entry once, preloaded with the page", async ({ page, goto }) => {
    const requests: string[] = [];
    page.on("request", request => request.url().includes("/entry/random") && requests.push(request.url()));
    await goto("/", { waitUntil: "hydration" });
    await expect(page.getByRole("region", { name: "Le Bailly ouvert au hasard" }).getByRole("status")).toHaveText(/^Entrée ouverte : /);
    // The preload's request, which the fetch took.
    expect(requests).toHaveLength(1);
    await expect(page.locator("link[rel=preload][as=fetch]")).toHaveAttribute("href", requests[0]!);
  });

  test("gives the focus to the search field on opening, but not on a touch screen", async ({ page, goto, browser }) => {
    await goto("/", { waitUntil: "hydration" });
    await expect(searchInput(page)).toBeFocused();

    const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, baseURL: page.url() });
    const mobile = await touch.newPage();
    await mobile.goto("/");
    await expect(mobile.getByRole("region", { name: "Le Bailly ouvert au hasard" }).getByRole("status")).toHaveText(/^Entrée ouverte : /);
    await expect(searchInput(mobile)).not.toBeFocused();
    await touch.close();
  });

  test("leaves the focus where it is when the search field holds a search", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await searchInput(page).fill("logos");
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "À propos", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/à-propos")}$`));
    await page.getByRole("link", { name: "Bailly.app" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(searchInput(page)).toHaveValue("λογος");
    await expect(searchInput(page)).not.toBeFocused();
  });

  test("offers the transliteration to those who don't read Greek, saved at once", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte : /);
    const word = opening.locator(".definition").first();
    await expect(word).toContainText(/\p{Script=Greek}/u);

    await page.getByRole("switch", { name: "Vous ne lisez pas le grec ?" }).click();
    await expect(word).not.toContainText(/\p{Script=Greek}/u);
    const cookies = await page.context().cookies();
    expect(decodeURIComponent(cookies.find(cookie => cookie.name === "bailly-preferences")?.value ?? "")).toContain("\"transliterateGreek\":true");
  });

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
