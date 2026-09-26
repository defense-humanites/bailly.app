import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput, searchResults } from "./helpers";

const GREEK = /[Ͱ-Ͽἀ-῿]/u;

test.describe("transliterated Greek", () => {
  test.beforeEach(async ({ page, goto }) => {
    await goto("/paramètres", { waitUntil: "hydration" });
    await page.getByRole("switch", { name: "Grec translittéré" }).click();
    await expect(page.getByRole("figure", { name: "Aperçu" })).toContainText("logo·technēs");
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

    await goto(`/lecteur?q=hai_(1),ho_(1)&forme=${encodeURIComponent("αἱ")}`, { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("hai");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["hai", "ho"]);
  });
});
