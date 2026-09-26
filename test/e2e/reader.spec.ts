import { expect, test } from "@nuxt/test-utils/playwright";

const definition = "main .definition";

test.describe("links of the definitions", () => {
  test("discreet, and an ambiguous form leads to the reader", async ({ page, goto }) => {
    await goto("/logades", { waitUntil: "hydration" });
    const ambiguous = page.locator(`${definition} a[data-linked-entries]`).first();
    await expect(ambiguous).toHaveText("αἱ");
    await expect(ambiguous).toHaveAttribute("href", `/lecteur?q=hai_(1),ho_(1)&forme=${encodeURIComponent("αἱ")}`);
    await expect(ambiguous).toHaveCSS("text-decoration-style", "dotted");
    // The forms of the current entry aren't links.
    await expect(page.locator(`${definition} a[data-linked-self]`)).toHaveCount(0);

    // Followed within the application (no reload).
    await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
    await ambiguous.click();
    await expect(page).toHaveURL(/\/lecteur\?q=hai_\(1\),ho_\(1\)&forme=/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("αἱ");
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  });
});

test.describe("reader", () => {
  test("an ambiguous form: its entries, and a bar to go from one to another", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await goto(`/lecteur?q=hai_(1),ho_(1)&forme=${encodeURIComponent("αἱ")}`, { waitUntil: "hydration" });
    await expect(page.locator("main header").first()).toContainText("Graphie ambiguë · 2 entrées");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["αἱ", "ὁ"]);
    await expect(page.getByRole("link", { name: "Ouvrir l'entrée ὁ" })).toHaveAttribute("href", "/ho_(1)");

    const bar = page.getByRole("navigation", { name: "Accès rapide aux entrées" });
    const chips = bar.getByRole("link");
    await expect(chips).toHaveText(["αἱ", "ὁ"]);
    await expect(chips.nth(0)).toHaveAttribute("aria-current", "true");

    await chips.nth(1).click();
    await expect(page).toHaveURL(/#entree-2$/);
    await expect(chips.nth(1)).toHaveAttribute("aria-current", "true");
    // The bar sticks under the header.
    const [barTop, headerBottom] = await page.evaluate(() => [
      document.querySelector("nav[aria-label='Accès rapide aux entrées']")!.getBoundingClientRect().top,
      document.querySelector("body > div header")!.getBoundingClientRect().bottom,
    ]);
    expect(Math.abs(barTop - headerBottom)).toBeLessThan(1);
  });

  test("the missing entries are reported", async ({ page, goto }) => {
    await goto("/lecteur?q=hai_(1),introuvable", { waitUntil: "hydration" });
    await expect(page.locator("main").getByRole("status")).toContainText("Entrée introuvable : introuvable.");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["αἱ"]);
  });

  test("a single entry: its page", async ({ page, goto }) => {
    await goto("/lecteur?q=logotechnês", { waitUntil: "hydration" });
    await expect(page).toHaveURL(/\/logotechn%C3%AAs$|\/logotechnês$/);
  });
});
