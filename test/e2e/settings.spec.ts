import { expect, test } from "@nuxt/test-utils/playwright";

test.describe("settings", () => {
  test("compact: all the settings at once on a desktop screen", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    await goto("/paramètres", { waitUntil: "hydration" });
    const reset = page.getByRole("button", { name: "Réinitialiser les paramètres" });
    await expect(reset).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(960);
  });

  test("no horizontal scroll on mobile", async ({ page, goto }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await goto("/paramètres", { waitUntil: "hydration" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test("reading: the text's size and weight, previewed, rendered by the server", async ({ page, goto, context }) => {
    await goto("/paramètres", { waitUntil: "hydration" });
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-size", "20px");
    await expect(preview).toHaveCSS("font-weight", "700");

    await page.getByRole("radio", { name: "Très grande" }).click({ force: true });
    await page.getByText("Normale", { exact: true }).nth(1).click();
    await expect(preview).toHaveCSS("font-size", "24px");
    await expect(preview).toHaveCSS("font-weight", "400");

    // The entry pages are rendered with them.
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-size="larger"/);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("main .definition").first()).toHaveCSS("font-size", "24px");

    // Reset: the defaults, and no cookie anymore.
    await goto("/paramètres", { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Réinitialiser les paramètres" }).click();
    await expect(preview).toHaveCSS("font-size", "20px");
    expect((await context.cookies()).find(cookie => cookie.name === "bailly-preferences")).toBeUndefined();
  });

  test("search: shared with the search options", async ({ page, goto }) => {
    await goto("/paramètres", { waitUntil: "hydration" });
    await page.getByText("Translittération", { exact: true }).click();
    await expect(page.locator("header input[role=combobox]")).toHaveAttribute("placeholder", "anazētéō…");
    await page.getByRole("switch", { name: "Formes fléchies" }).click();
    await page.getByRole("button", { name: "Options de recherche" }).click();
    await expect(page.getByRole("dialog").getByRole("switch", { name: /Formes fléchies/ })).not.toBeChecked();
  });
});
