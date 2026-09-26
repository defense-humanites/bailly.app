import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks, tagNamesOf } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };

const otherTags = (page: Page) => page.getByRole("dialog", { name: "Autres étiquettes" });

test.describe("other tags of an entry", () => {
  test("any tag but the current one, in the user's order, pressed if the entry has it", async ({ page, goto }) => {
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

    await page.getByRole("button", { name: "Autres étiquettes" }).click();
    const buttons = otherTags(page).getByRole("listitem").getByRole("button");
    await expect(buttons).toHaveText(["Rouge", "Vert"]);
    await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");

    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
    await buttons.nth(1).click();
    await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
  });

  test("without other tags, a message and the link to manage them", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Seule", color: "Green" }] });
    await page.getByRole("button", { name: "Autres étiquettes" }).click();
    await expect(otherTags(page)).toContainText("Aucune autre étiquette.");
    await otherTags(page).getByRole("link", { name: "Gérer les étiquettes" }).click();
    await expect(page).toHaveURL(/\/signets$/);
  });
});
