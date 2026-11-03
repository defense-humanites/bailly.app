import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks } from "./helpers";

const star = (page: Page) => page.getByRole("button", { name: "Favori" }).first();
const bubble = (page: Page) => page.getByRole("dialog").filter({ hasText: "Entrée ajoutée aux favoris" });

test.describe("the bookmarks introduced at a star, until read", () => {
  test("read with « Compris »: closed back to the star, not shown again", async ({ page, goto }) => {
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

  test("read with « Voir les signets »: leads to them, not shown again", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await star(page).click();
    await bubble(page).getByRole("link", { name: "Voir les signets" }).click();
    await expect(page).toHaveURL(/\/signets$/);
    // Read: not shown again.
    await goto("/logades", { waitUntil: "hydration" });
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    await expect(bubble(page)).toBeHidden();
  });

  test("not to a user who has tags already", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Lectures", color: "Sky" }] });
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    await expect(bubble(page)).toBeHidden();
  });

  test("closed otherwise than by its buttons, shows again at the next star", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // The star clicked again (the favorite removed): closed, not read.
    await star(page).click();
    await expect(bubble(page)).toBeVisible();
    await star(page).click();
    await expect(star(page)).toHaveAttribute("aria-pressed", "false");
    await expect(bubble(page)).toBeHidden();
    // Shown again; a click elsewhere closes it, not read either.
    await star(page).click();
    await expect(bubble(page)).toBeVisible();
    await page.mouse.click(5, 400);
    await expect(bubble(page)).toBeHidden();
    // On another entry, the favorites not empty: shown again.
    await goto("/logades", { waitUntil: "hydration" });
    await star(page).click();
    await expect(bubble(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bubble(page)).toBeHidden();
  });
});
