import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput } from "./helpers";

test.describe("about page", () => {
  test("tells the dictionary, its digital edition and the application apart", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    const lineage = page.getByRole("region", { name: "D'où vient le texte" });
    await expect(lineage.getByRole("heading", { level: 3 })).toHaveText([
      "Le dictionnaire d'Anatole Bailly",
      "L'édition numérique de Gérard Gréco",
      "L'application Bailly",
    ]);
    // The errors of the text go to the team of the edition, the others to us.
    await expect(lineage.getByRole("link", { name: "Signaler une erreur" }))
      .toHaveAttribute("href", /^mailto:numerisation\.gaffiot@hotmail\.fr\?subject=/);
    await expect(lineage.getByRole("link", { name: "Signaler un problème" }))
      .toHaveAttribute("href", "mailto:contact@bailly.app");
  });

  test("« Chercher un mot » gives the focus to the search field", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Chercher un mot" }).click();
    await expect(searchInput(page)).toBeFocused();
  });

  test("leads to the privacy page", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await page.getByRole("link", { name: "confidentialité" }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/confidentialité")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vos données");
    await expect(page.getByRole("region", { name: "En bref" })).toBeVisible();
  });

  test("the contributors to the Bailly 2020, behind its « et al. »", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await page.getByRole("button", { name: /^Et al\. : les 37 contributeurs/ }).click();
    const list = page.getByRole("dialog").getByRole("listitem");
    await expect(list).toHaveCount(37);
    await expect(list.first()).toHaveText("José Antonio Artés");
  });
});

test.describe("about page: the hero", () => {
  const sizes = (page: import("@playwright/test").Page) => page.locator("main h1").evaluate((title) => {
    const subtitle = title.nextElementSibling!;
    const logo = title.previousElementSibling!;
    return [getComputedStyle(title).fontSize, getComputedStyle(subtitle).fontSize, logo.getBoundingClientRect().height];
  });

  test("from md, its texts a notch smaller on a short window", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    expect((await sizes(page)).slice(0, 2)).toEqual(["36px", "20px"]);
    await page.setViewportSize({ width: 1280, height: 650 });
    expect((await sizes(page)).slice(0, 2)).toEqual(["30px", "18px"]);
  });

  test("on a tall phone, a larger logo", async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    expect((await sizes(page))[2]).toBeGreaterThan(80);
    await page.setViewportSize({ width: 390, height: 560 });
    expect((await sizes(page))[2]).toBeLessThan(60);
  });
});

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark" });

  test("the pictures dimmed, not the logo", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.locator("img[src$='.webp']").first()).toHaveCSS("filter", "brightness(0.85)");
    await expect(page.locator("header img").last()).toHaveCSS("filter", "none");
  });
});
