import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks } from "./helpers";

const anax = { word: "ἄναξ", uri: "anax", excerpt: "ἄναξ, gén. ἄνακτος (ὁ) [ᾰν] maître, chef, roi : 1 en parl. des dieux, particul. d’Apollon, avec ou sans Ἀπόλλων : ἄναξ Ἄπολλον, Eschl. Ag. 513, etc. …" };

const star = (page: Page) => page.getByRole("button", { name: "Favori" }).first();
const bubble = (page: Page) => page.getByRole("dialog").filter({ hasText: "Entrée ajoutée aux favoris" });

test.describe("the bookmarks introduced at the first star", () => {
  test("once, closed back to the star; leading to the bookmarks", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await star(page).click();
    await expect(bubble(page)).toBeVisible();
    await bubble(page).getByRole("button", { name: "Compris" }).click();
    await expect(bubble(page)).toBeHidden();
    await expect(star(page)).toBeFocused();

    // Not again, here or on another entry.
    await star(page).click();
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await goto("/logades", { waitUntil: "hydration" });
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    await expect(bubble(page)).toBeHidden();
  });

  test("leads to the bookmarks page", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await star(page).click();
    await bubble(page).getByRole("link", { name: "Voir les signets" }).click();
    await expect(page).toHaveURL(/\/signets$/);
  });

  test("not to a user who has tags already", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Lectures", color: "Sky" }] });
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    await expect(bubble(page)).toBeHidden();
  });

  test("not to a user who has favorites already", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { starred: [anax] });
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    await expect(bubble(page)).toBeHidden();
  });
});
