import { expect, test } from "@nuxt/test-utils/playwright";

// The entry's citation: from `xl`, on its right; below, in a window.
test.describe("citing an entry", () => {
  test("on the right from xl: the forms, the bibliography's style, a copy", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logos", { waitUntil: "hydration" });
    const citation = page.getByRole("complementary", { name: "Citer cette entrée" });
    const entryReference = citation.locator("p").first();
    await expect(entryReference).toContainText("s. v. « λόγος », https://bailly.app/logos (consulté le");

    await citation.getByRole("tab", { name: "Auteur-date" }).click();
    await expect(entryReference).toHaveText("(Bailly, 2023, s. v. λόγος)");
    await citation.getByRole("button", { name: "Copier" }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("(Bailly, 2023, s. v. λόγος)");

    // Author-date follows the bibliography's style; both choices kept.
    await citation.getByRole("combobox", { name: "Norme de la bibliographie" }).click();
    await page.getByRole("option", { name: "ISO 690" }).click();
    await expect(entryReference).toHaveText("(Bailly, 2023 : s. v. λόγος)");
    await expect(citation.locator("p").nth(1)).toContainText("BAILLY, Anatole.");
    await page.reload();
    await expect(citation.getByRole("tab", { name: "Auteur-date" })).toHaveAttribute("aria-selected", "true");
    await expect(citation.locator("p").nth(1)).toContainText("BAILLY, Anatole.");
  });

  test("a homonym cited as in M. Gréco's edition", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto("/logades#2", { waitUntil: "hydration" });
    await expect(page.getByRole("complementary", { name: "Citer cette entrée" }).locator("p").first())
      .toContainText("« 2 λογάδες », https://bailly.app/logades#2");
  });

  test("below xl, in a window", async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.getByRole("complementary", { name: "Citer cette entrée" })).toBeHidden();
    await page.getByRole("button", { name: "Citer", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Citer cette entrée" }).getByText("Bailly, A. (2023).", { exact: false })).toBeVisible();
  });
});
