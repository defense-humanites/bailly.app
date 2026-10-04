import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput, searchResults } from "./helpers";

test.describe("error page", () => {
  test("an unknown address: not found, the search bar at hand", async ({ page, goto }) => {
    await goto("/une-entree-inexistante", { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
    await expect(page).toHaveTitle(/Page introuvable/);
    await expect(searchInput(page)).toBeVisible();
    // The header whole (its menu needs Nuxt UI's providers, `UApp`).
    await expect(page.locator("header").getByRole("link", { name: "Signets" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    // A search leads out of it.
    await searchInput(page).fill("logos");
    await expect(searchResults(page).getByRole("option").filter({ hasText: "λόγος" }).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/logos$/);
    await expect(page.locator("main h1")).toHaveText("λόγος");
  });
});
