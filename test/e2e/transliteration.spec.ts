import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput, searchResults } from "./helpers";

const GREEK = /[Ͱ-Ͽἀ-῿]/u;

test.describe("transliterated Greek", () => {
  test.beforeEach(async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    await page.getByRole("switch", { name: "Grec translittéré" }).click();
    // The preview's headword, transliterated (the entry is drawn at random).
    await expect(page.getByRole("figure", { name: "Aperçu" }).locator(".entreea")).not.toHaveText(GREEK);
  });

  test("the entry page, rendered by the server", async ({ page, goto }) => {
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toContain("<span class=\"grec\">logos,</span>");

    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("main h1")).toHaveText("logos");
    const article = await page.locator("main article").textContent();
    expect(article).not.toMatch(GREEK);
    await expect(page.getByRole("link", { name: /^Entrée suivante : / }).first()).toHaveAccessibleName(/^Entrée suivante : [a-zāēōū·]+$/);
  });

  test("the results and the reader", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await searchInput(page).fill("logos");
    await expect(searchResults(page).getByRole("option", { name: /^logos, ou/ })).toBeVisible();

    await goto(`/forme/${encodeURIComponent("αἱ")}?q=hai_(1),ho_(1)`, { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("hai");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["hai", "ho"]);
  });
});
