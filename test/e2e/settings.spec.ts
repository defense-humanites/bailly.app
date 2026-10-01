import { expect, test } from "@nuxt/test-utils/playwright";
import { PREVIEW_ENTRIES } from "../../app/utils/previewEntries";
import { rootLength } from "./helpers";

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
    // The header steps out of the content by the search bar's overhangs.
    const overhang = await rootLength(page, "--search-overhang");
    expect(Math.abs(general.left - nav.left - overhang)).toBeLessThanOrEqual(1);
    expect(Math.abs(nav.right - reading.right - overhang)).toBeLessThanOrEqual(1);
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
    // Bailly Book by default.
    await goto("/logos", { waitUntil: "hydration" });
    await expect(page.locator("link[rel=preload][as=font]")).toHaveAttribute("href", /^\/_nuxt\/BaillyBook-Roman\.subset\.[\w-]+\.woff2$/);

    await goto("/préférences", { waitUntil: "hydration" });
    await page.getByRole("combobox", { name: "Police" }).click();
    await page.getByRole("option", { name: "GFS NeoHellenic" }).click();
    const preview = page.getByRole("figure", { name: "Aperçu" });
    await expect(preview).toHaveCSS("font-family", /^"GFS Neohellenic"/);

    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toMatch(/<html[^>]*data-reading-font="neohellenic"/);
    expect(html).toMatch(/href="\/_nuxt\/GFS_NeoHellenic-Roman\.[\w-]+\.woff2"/);

    // The faces requested by the page.
    await goto("/logos", { waitUntil: "hydration" });
    const requested = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter(face => face.status !== "unloaded").map(face => face.family.replace(/"/g, ""));
    });
    expect(requested).toContain("GFS Neohellenic");
    expect(requested).not.toContain("Bailly Book");
  });

  // In their italic and bold faces, U+2009 is drawn (in Didot Italic, an
  // exclamation mark), and U+202F, missing, was shaped with it: Inter's
  // spaces stand in for them (cf. fonts.css).
  test("reading: the thin spaces of the reading fonts are spaces", async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    const widths = await page.evaluate(async () => {
      const result: Record<string, { narrow: number; thin: number }> = {};
      for (const family of ["Bailly Book", "GFS Didot", "GFS Artemisia", "GFS Bodoni", "GFS Neohellenic"]) {
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
    // Inter's thin space: 0.18 em, scaled as the font (100 px: 20 to 25 px);
    // the exclamation mark was 53 px wide in Didot. Bailly Book's own: 0.15 to
    // 0.17 em, scaled.
    for (const [face, { narrow, thin }] of Object.entries(widths)) {
      expect(narrow, face).toBeGreaterThan(15);
      expect(narrow, face).toBeLessThan(30);
      expect(thin, face).toBeGreaterThan(15);
      expect(thin, face).toBeLessThan(30);
      // The GFS fonts' come from Inter (the same width).
      if (face.startsWith("GFS")) expect(thin, face).toBeCloseTo(narrow, 1);
    }
  });

  test("reading: the fonts in alphabetical order, the default one first", async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    await page.getByRole("combobox", { name: "Police" }).click();
    await expect(page.getByRole("option")).toHaveText(["Bailly Book", "GFS Artemisia", "GFS Bodoni", "GFS Didot", "GFS NeoHellenic"]);
  });

  test("reading: the preview's entry, drawn at each visit, the same once hydrated", async ({ page, goto }) => {
    const words = new Set(PREVIEW_ENTRIES.map(entry => entry.html.match(/<span class="grec">([^<]+),<\/span>/)![1]));
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text());
    });
    const seen = new Set<string>();
    for (let visit = 0; visit < 12 && seen.size < 2; visit++) {
      await goto("/préférences", { waitUntil: "hydration" });
      const word = (await page.getByRole("figure", { name: "Aperçu" }).locator(".entreea .grec").textContent())!.replace(/,$/, "");
      expect(words).toContain(word);
      seen.add(word);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(errors).toEqual([]);
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
