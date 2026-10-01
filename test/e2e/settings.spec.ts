import { expect, test } from "@nuxt/test-utils/playwright";

test.describe("settings", () => {
  test("the former address, « /paramètres », redirects to the preferences", async ({ page }) => {
    const response = await page.request.get("/paramètres", { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    await page.goto("/paramètres");
    await expect(page).toHaveURL(/\/pr%C3%A9f%C3%A9rences$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Préférences");
  });

  test("compact: all the settings at once on a desktop screen", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/préférences", { waitUntil: "hydration" });
    const reset = page.getByRole("button", { name: "Réinitialiser les préférences" });
    await expect(reset).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
  });

  test("two columns from lg, centered under the header; one below", async ({ page, goto }) => {
    const extent = (selector: string) => page.locator(selector).first().evaluate((element) => {
      const { left, right, top } = element.getBoundingClientRect();
      return { left: Math.round(left), right: Math.round(right), top: Math.round(top) };
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto("/préférences", { waitUntil: "hydration" });
    const nav = await extent("header > nav");
    const general = await extent("[aria-labelledby=settings-general]");
    const reading = await extent("[aria-labelledby=settings-reading]");
    const search = await extent("[aria-labelledby=settings-search]");
    // The header steps out of the content by the search bar's overhangs (3rem).
    expect(general.left).toBe(nav.left + 48);
    expect(reading.right).toBe(nav.right - 48);
    expect(reading.top).toBe(general.top);
    expect(search.left).toBe(general.left);

    await page.setViewportSize({ width: 900, height: 900 });
    const narrow = await extent("[aria-labelledby=settings-reading]");
    expect(Math.abs((narrow.left + narrow.right) / 2 - 450)).toBeLessThanOrEqual(1);
  });

  test("no horizontal scroll on mobile", async ({ page, goto }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await goto("/préférences", { waitUntil: "hydration" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test("reading: the text's size and weight, previewed, rendered by the server", async ({ page, goto, context }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-size", "15.5px");
    await expect(preview).toHaveCSS("font-weight", "400");

    await page.getByRole("radio", { name: "Très grande" }).click({ force: true });
    await page.getByText("Appuyée", { exact: true }).click();
    await expect(preview).toHaveCSS("font-size", "18.5px");
    await expect(preview).toHaveCSS("font-weight", "700");

    // The entry pages are rendered with them.
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-size="larger"/);
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("main .definition").first()).toHaveCSS("font-size", "18.5px");

    // Reset: the defaults, and no cookie anymore.
    await goto("/préférences", { waitUntil: "hydration" });
    // Confirmed first: cancelling keeps the settings.
    await page.getByRole("button", { name: "Réinitialiser les préférences" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
    await expect(preview).toHaveCSS("font-size", "18.5px");
    await page.getByRole("button", { name: "Réinitialiser les préférences" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Réinitialiser", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(preview).toHaveCSS("font-size", "15.5px");
    expect((await context.cookies()).find(cookie => cookie.name === "bailly-preferences")).toBeUndefined();
  });

  test("reading: the font, preloaded, and only its faces downloaded", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("link[rel=preload][as=font]")).toHaveAttribute("href", /^\/_nuxt\/Brill-Roman\.subset\.[\w-]+\.woff2$/);

    await goto("/préférences", { waitUntil: "hydration" });
    await page.getByRole("combobox", { name: "Police" }).click();
    await page.getByRole("option", { name: "GFS Didot" }).click();
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-family", /^"GFS Didot"/);

    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-font="didot"/);
    expect(html).toMatch(/href="\/_nuxt\/GFS_Didot-Roman\.[\w-]+\.woff2"/);

    // The faces requested by the page.
    await goto("/logos", { waitUntil: "hydration" });
    const requested = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter(face => face.status !== "unloaded").map(face => face.family.replace(/"/g, ""));
    });
    expect(requested).toContain("GFS Didot");
    expect(requested).not.toContain("Brill");
    expect(requested).not.toContain("GFS Neohellenic");
  });

  // In their italic and bold faces, U+2009 is drawn (in Didot Italic, an
  // exclamation mark), and U+202F, missing, was shaped with it: Inter's
  // spaces stand in for them (cf. fonts.css).
  test("reading: the thin spaces of GFS Didot and GFS Neohellenic are spaces", async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    const widths = await page.evaluate(async () => {
      const result: Record<string, { narrow: number; thin: number }> = {};
      for (const family of ["GFS Didot", "GFS Neohellenic"]) {
        for (const style of ["normal", "italic"]) {
          for (const weight of ["400", "700"]) {
            const font = `${style} ${weight} 100px "${family}"`;
            await document.fonts.load(font, "a\u2009\u202f");
            const span = document.createElement("span");
            span.style.font = font;
            span.style.whiteSpace = "pre";
            document.body.append(span);
            const width = (text: string): number => {
              span.textContent = text;
              return span.getBoundingClientRect().width;
            };
            result[`${family} ${style} ${weight}`] = { narrow: width("\u202f"), thin: width("\u2009") };
            span.remove();
          }
        }
      }
      return result;
    });
    // Inter's thin space: 0.18 em, scaled as the font (100 px: 21 px for
    // Didot, 25 px for Neohellenic); the exclamation mark was 53 px wide.
    for (const [face, { narrow, thin }] of Object.entries(widths)) {
      expect(narrow, face).toBeGreaterThan(15);
      expect(narrow, face).toBeLessThan(30);
      expect(thin, face).toBeCloseTo(narrow, 1);
    }
  });

  test("search: shared with the search options", async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    await page.getByText("Translittération", { exact: true }).click();
    await expect(page.locator("header input[role=combobox]")).toHaveAttribute("placeholder", "anazētéō…");
    await page.getByRole("switch", { name: "Formes fléchies" }).click();
    await page.getByRole("button", { name: "Options de recherche" }).click();
    await expect(page.getByRole("dialog").getByRole("switch", { name: /Formes fléchies/ })).not.toBeChecked();
  });
});
