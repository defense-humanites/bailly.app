import { expect, test } from "@nuxt/test-utils/playwright";

test.describe("settings", () => {
  test("compact: all the settings at once on a desktop screen", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/paramètres", { waitUntil: "hydration" });
    const reset = page.getByRole("button", { name: "Réinitialiser les paramètres" });
    await expect(reset).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
  });

  test("two columns from lg, aligned with the header; one below", async ({ page, goto }) => {
    const extent = (selector: string) => page.locator(selector).first().evaluate((element) => {
      const { left, right, top } = element.getBoundingClientRect();
      return { left: Math.round(left), right: Math.round(right), top: Math.round(top) };
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto("/paramètres", { waitUntil: "hydration" });
    const nav = await extent("header > nav");
    const general = await extent("[aria-labelledby=settings-general]");
    const reading = await extent("[aria-labelledby=settings-reading]");
    const search = await extent("[aria-labelledby=settings-search]");
    expect(general.left).toBe(nav.left);
    expect(reading.right).toBe(nav.right);
    expect(reading.top).toBe(general.top);
    expect(search.left).toBe(general.left);

    await page.setViewportSize({ width: 900, height: 900 });
    const narrow = await extent("[aria-labelledby=settings-reading]");
    expect(Math.abs((narrow.left + narrow.right) / 2 - 450)).toBeLessThanOrEqual(1);
  });

  test("no horizontal scroll on mobile", async ({ page, goto }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await goto("/paramètres", { waitUntil: "hydration" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test("reading: the text's size and weight, previewed, rendered by the server", async ({ page, goto, context }) => {
    await goto("/paramètres", { waitUntil: "hydration" });
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-size", "15.5px");
    await expect(preview).toHaveCSS("font-weight", "700");

    await page.getByRole("radio", { name: "Très grande" }).click({ force: true });
    await page.getByText("Normale", { exact: true }).nth(1).click();
    await expect(preview).toHaveCSS("font-size", "18.5px");
    await expect(preview).toHaveCSS("font-weight", "400");

    // The entry pages are rendered with them.
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-size="larger"/);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("main .definition").first()).toHaveCSS("font-size", "18.5px");

    // Reset: the defaults, and no cookie anymore.
    await goto("/paramètres", { waitUntil: "hydration" });
    // Confirmed first: cancelling keeps the settings.
    await page.getByRole("button", { name: "Réinitialiser les paramètres" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
    await expect(preview).toHaveCSS("font-size", "18.5px");
    await page.getByRole("button", { name: "Réinitialiser les paramètres" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Réinitialiser", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(preview).toHaveCSS("font-size", "15.5px");
    expect((await context.cookies()).find(cookie => cookie.name === "bailly-preferences")).toBeUndefined();
  });

  test("reading: the font, preloaded, and only its faces downloaded", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("link[rel=preload][as=font]")).toHaveAttribute("href", "/fonts/Brill-Bold.woff2");

    await goto("/paramètres", { waitUntil: "hydration" });
    await page.getByRole("combobox", { name: "Police" }).click();
    await page.getByRole("option", { name: "Gentium Plus" }).click();
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-family", /^"Gentium Plus"/);

    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-font="gentium"/);
    expect(html).toContain("href=\"/fonts/Gentium_Plus/GentiumPlus-Bold.ttf\"");

    // The faces requested by the page (loaded, or failed where the trial
    // fonts aren't committed, e.g. in CI).
    await goto("/logos", { waitUntil: "hydration" });
    const requested = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter(face => face.status !== "unloaded").map(face => face.family.replace(/"/g, ""));
    });
    expect(requested).toContain("Gentium Plus");
    expect(requested).not.toContain("Brill");
    expect(requested).not.toContain("GFS Didot");
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
