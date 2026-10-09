import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";

// The entry's citation: in a window, from a button at the card's top.
const openCitation = async (page: Page) => {
  await page.locator("main").getByRole("button", { name: "Citer cette entrée" }).first().click();
  return page.getByRole("dialog", { name: "Citer cette entrée" });
};

test.describe("citing an entry", () => {
  test("the forms, the bibliography's style, a copy", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logos", { waitUntil: "hydration" });
    let citation = await openCitation(page);
    const entryReference = citation.locator("section p").first();
    await expect(entryReference).toContainText("s. v. « λόγος », https://bailly.app/logos (consulté le");

    await citation.getByRole("combobox", { name: "Forme de la référence" }).click();
    await page.getByRole("option", { name: "Auteur-date" }).click();
    await expect(entryReference).toHaveText("(Bailly, 2023, s. v. λόγος)");
    // Copied by its button (or a click on it), as the synchronization's key.
    await citation.getByRole("button", { name: "Copier la référence" }).first().click();
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("(Bailly, 2023, s. v. λόγος)");

    // Author-date follows the bibliography's style; both choices kept.
    await citation.getByRole("combobox", { name: "Norme de la bibliographie" }).click();
    await page.getByRole("option", { name: "ISO 690" }).click();
    await expect(entryReference).toHaveText("(Bailly, 2023 : s. v. λόγος)");
    await expect(citation.locator("section p").nth(1)).toContainText("BAILLY, Anatole.");
    await page.reload();
    citation = await openCitation(page);
    await expect(citation.getByRole("combobox", { name: "Forme de la référence" })).toContainText("Auteur-date");
    await expect(citation.locator("section p").nth(1)).toContainText("BAILLY, Anatole.");
  });

  test("a homonym cited as in M. Gréco's edition", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto("/logades#2", { waitUntil: "hydration" });
    await expect((await openCitation(page)).locator("section p").first())
      .toContainText("« 2 λογάδες », https://bailly.app/logades#2");
  });

  test("at every width, from the card's top", async ({ page, goto }) => {
    for (const width of [390, 1150, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await goto("/logos", { waitUntil: "hydration" });
      const dialog = await openCitation(page);
      await expect(dialog.getByText("Bailly, A. (2023).", { exact: false })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("on the home page's random entry", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await opening.getByRole("button", { name: "Citer cette entrée" }).click();
    await expect(page.getByRole("dialog", { name: "Citer cette entrée" }).getByText("https://bailly.app/", { exact: false }).first()).toBeVisible();
  });
});
