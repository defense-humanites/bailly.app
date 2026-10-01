import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks, tagNamesOf } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };

const allTags = (page: Page) => page.getByRole("dialog", { name: "Toutes les étiquettes" });

test.describe("the tags of an entry", () => {
  test("every tag, the current one first (active), then in the user's order, selected if the entry has it", async ({ page, goto }) => {
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
    const list = allTags(page).getByRole("listbox");
    await expect(list).toHaveAttribute("aria-multiselectable", "true");
    // Few tags: no filter.
    await expect(allTags(page).getByRole("textbox")).toHaveCount(0);
    const options = list.getByRole("option");
    await expect(options).toHaveText(["Cielactive", "Rouge", "Vert"]);
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");

    await options.nth(1).click();
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await options.nth(2).click();
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
    // The order does not change while the panel is open.
    await expect(options).toHaveText(["Cielactive", "Rouge", "Vert"]);

    // The current tag, from the panel or from its own button (named after it,
    // its state in aria-pressed, its action in a tooltip).
    await options.nth(0).click();
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge", "Ciel"]);
    await page.keyboard.press("Escape");
    await expect(allTags(page)).toBeHidden();
    const current = page.getByRole("button", { name: "Étiquette active : Ciel" });
    await expect(current).toHaveAttribute("aria-pressed", "true");
    await current.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Retirer de « Ciel »");
    await current.click();
    await expect(current).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
  });

  test("from eight tags, a field filters them, ignoring case and accents; Enter toggles the option", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const names = ["Éthique", "Médecine", "Poésie", "Rhétorique", "Histoire", "Tragédie", "Comédie", "Épopée"];
    await seedBookmarks(page, { tags: names.map(name => ({ name, color: "Sky" })), current: "Éthique" });

    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const filter = allTags(page).getByRole("textbox");
    await expect(filter).toHaveAttribute("placeholder", "Filtrer les étiquettes");
    await expect(filter).toBeFocused();
    const options = allTags(page).getByRole("option");
    await expect(options).toHaveCount(8);

    await filter.fill("TRAGEDIE");
    await expect(options).toHaveText(["Tragédie"]);
    await page.keyboard.press("Enter");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Tragédie"]);

    await filter.fill("epo");
    await expect(options).toHaveText(["Épopée"]);
    await filter.fill("zzz");
    await expect(options).toHaveCount(0);
    await expect(allTags(page)).toContainText("Aucune étiquette ne correspond.");
  });

  test("the active tag, chosen in the panel", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      tags: [
        { name: "Vert", color: "Green" },
        { name: "Ciel", color: "Sky" },
      ],
      current: "Ciel",
    });
    await expect(page.getByRole("button", { name: "Étiquette active : Ciel" })).toBeVisible();

    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    await allTags(page).getByRole("button", { name: "Active", exact: true }).click();
    await page.getByRole("option", { name: "Vert" }).last().click();
    await expect(page.getByRole("button", { name: "Étiquette active : Vert" })).toBeVisible();
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
