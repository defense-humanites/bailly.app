import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput } from "./helpers";

test.describe("about page", () => {
  test("tells the dictionary, its digital edition and the application apart", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    const lineage = page.getByRole("region", { name: "D'où vient le texte" });
    await expect(lineage.getByRole("heading", { level: 3 })).toHaveText([
      "Le dictionnaire d'Anatole Bailly",
      "L'édition numérique Bailly 2020 Hugo Chávez",
      "L'application Bailly.app",
    ]);
    // The errors of the text go to the team of the edition, the others to us.
    await expect(lineage.getByRole("link", { name: "Signaler une erreur dans le texte" }))
      .toHaveAttribute("href", /^mailto:numerisation\.gaffiot@hotmail\.fr\?subject=/);
    await expect(lineage.getByRole("link", { name: "Signaler un problème de l'application" }))
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
    await expect(page).toHaveURL(/\/confidentialite$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vos données");
    await expect(page.getByRole("region", { name: "En bref" })).toBeVisible();
  });
});
