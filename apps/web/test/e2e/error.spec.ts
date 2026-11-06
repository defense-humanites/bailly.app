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

  test("a failure while starting: the error page alone, the page served cleared", async ({ page }) => {
    // The API plugin fails in the browser only (as with `URL.canParse` on
    // iOS 16, issue #10): its host refused as a URL.
    await page.addInitScript(() => {
      const NativeURL = URL;
      window.URL = new Proxy(NativeURL, {
        construct(target, [url, base]: [string | URL, string?]) {
          if (String(url).startsWith("http://127.0.0.1:4010")) throw new TypeError("Invalid URL");
          return new target(url, base);
        },
      });
    });
    await page.goto(encodeURI("/à-propos"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Une erreur est survenue");
    // Try again, or write to us, the page in the subject.
    await expect(page.getByRole("link", { name: "écrivez-nous" }))
      .toHaveAttribute("href", `mailto:contact@bailly.app?subject=${encodeURIComponent("Erreur sur la page /à-propos")}`);
    // Nothing of the page served left under it.
    await expect(page.getByRole("heading", { name: /Le dictionnaire grec-français/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Signets" })).toHaveCount(1);
  });
});
