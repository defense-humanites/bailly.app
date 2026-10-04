import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput } from "./helpers";

test.describe("error page", () => {
  test("an unknown address: not found, the search bar at hand, back home", async ({ page, goto }) => {
    await goto("/une-entree-inexistante", { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
    await expect(page).toHaveTitle(/Page introuvable/);
    await expect(searchInput(page)).toBeVisible();
    // The header whole (its menu needs Nuxt UI's providers, `UApp`).
    await expect(page.locator("header").getByRole("link", { name: "Signets" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await page.getByRole("button", { name: "Retour à l'accueil" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("region", { name: "Le Bailly ouvert au hasard" })).toBeVisible();
  });
});
