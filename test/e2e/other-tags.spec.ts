import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks, tagNamesOf } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };

const allTags = (page: Page) => page.getByRole("dialog", { name: "Toutes les étiquettes" });

test.describe("the tags of an entry", () => {
  test("every tag, the current one first (active), then in the user's order, pressed if the entry has it", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // In the user's order: Rouge, Ciel, Vert; the current tag is Ciel.
    await seedBookmarks(page, {
      tags: [
        { name: "Vert", color: "Green", entries: [logos] },
        { name: "Ciel", color: "Sky" },
        { name: "Rouge", color: "Red" },
      ],
      current: "Ciel",
    });

    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const buttons = allTags(page).getByRole("listitem").getByRole("button");
    await expect(buttons).toHaveText(["Cielactive", "Rouge", "Vert"]);
    await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");

    await buttons.nth(1).click();
    await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
    await buttons.nth(2).click();
    await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);

    // The current tag, from the panel or from its own button (named after it,
    // its state in aria-pressed, its action in a tooltip).
    await buttons.nth(0).click();
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge", "Ciel"]);
    await page.keyboard.press("Escape");
    const current = page.getByRole("button", { name: "Étiquette active : Ciel" });
    await expect(current).toHaveAttribute("aria-pressed", "true");
    await current.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Retirer de « Ciel »");
    await current.click();
    await expect(current).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
  });

  test("without tags, a message and the link to manage them", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    await expect(allTags(page)).toContainText("Aucune étiquette pour l'instant.");
    await allTags(page).getByRole("link", { name: "Gérer les étiquettes" }).click();
    await expect(page).toHaveURL(/\/signets$/);
  });

  test("the favorite: named, its state in aria-pressed, its action in a tooltip", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const star = page.getByRole("button", { name: "Favori" });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Ajouter aux favoris");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
  });
});
