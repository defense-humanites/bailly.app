import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput } from "./helpers";

test.describe("home page", () => {
  test("opens the dictionary at random: an entry between its neighbors", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    // The fake API always draws the same (recorded) entry.
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte : /);
    await expect(opening.locator(".definition")).toBeVisible();
    const previous = opening.getByRole("link", { name: /^Entrée précédente : / });
    const next = opening.getByRole("link", { name: /^Entrée suivante : / });
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();

    // Another draw, without reloading the page.
    const requests: string[] = [];
    page.on("request", request => request.url().includes("/entry/random") && requests.push(request.url()));
    await opening.getByRole("button", { name: "Ouvrir à une autre page" }).click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(opening.getByRole("status")).toHaveText(/^Entrée ouverte : /);

    // A neighbor leads to its page.
    const href = await next.getAttribute("href");
    await next.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test("« Chercher un mot » gives the focus to the search field", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Chercher un mot" }).click();
    await expect(searchInput(page)).toBeFocused();
  });

  test("leads to the about page", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("link", { name: /^D'où vient le texte/ }).click();
    await expect(page).toHaveURL(new RegExp(`${encodeURI("/à-propos")}$`));
  });
});
