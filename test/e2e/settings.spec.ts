import { expect, test } from "@nuxt/test-utils/playwright";
import { PREVIEW_ENTRIES } from "../../app/utils/previewEntries";
import { pageCenter, rootLength } from "./helpers";

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
    // The search below, partly shown.
    for (const name of ["Synchronisation", "Général", "Lecture", "Signets"]) {
      await expect(page.getByRole("region", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole("heading", { name: "Recherche" })).toBeInViewport();
    // The reset under the bookmarks' settings (the shorter column), at its end.
    const reset = page.getByRole("button", { name: "Réinitialiser les préférences" });
    await expect(reset).toBeInViewport({ ratio: 1 });
    const [card, button] = await Promise.all([page.getByRole("region", { name: "Signets", exact: true }).boundingBox(), reset.boundingBox()]);
    expect(button!.y).toBeGreaterThan(card!.y + card!.height);
    expect(Math.abs(button!.x + button!.width - (card!.x + card!.width))).toBeLessThan(1);
  });

  test("the theme: kept in a cookie, shown as chosen once reloaded", async ({ page, goto, context }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    await page.locator("[data-slot=label]", { hasText: "Sombre" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect((await context.cookies()).find(cookie => cookie.name === "bailly-theme")?.value).toBe("dark");
    await page.reload();
    await expect(page.getByRole("radio", { name: "Sombre" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Système" })).not.toBeChecked();
  });

  test("two columns from lg, centered under the header; one below", async ({ page, goto }) => {
    const extent = (selector: string) => page.locator(selector).first().evaluate((element) => {
      const { left, right, top } = element.getBoundingClientRect();
      return { left: Math.round(left), right: Math.round(right), top: Math.round(top) };
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto("/préférences", { waitUntil: "hydration" });
    const nav = await extent("header > nav");
    const sync = await extent("[aria-labelledby=settings-sync]");
    const general = await extent("[aria-labelledby=settings-general]");
    const reading = await extent("[aria-labelledby=settings-reading]");
    const search = await extent("[aria-labelledby=settings-search]");
    const bookmarks = await extent("[aria-labelledby=settings-bookmarks]");
    // The header steps out of the content by the search bar's overhangs.
    const overhang = await rootLength(page, "--search-overhang");
    expect(Math.abs(general.left - nav.left - overhang)).toBeLessThanOrEqual(1);
    expect(Math.abs(nav.right - reading.right - overhang)).toBeLessThanOrEqual(1);
    // The synchronization first, on the left.
    expect(reading.top).toBe(sync.top);
    expect(general.left).toBe(sync.left);
    expect(general.top).toBeGreaterThan(sync.top);
    expect(search.left).toBe(general.left);
    // The bookmarks' settings under the reading ones (the columns balanced).
    expect(bookmarks.left).toBe(reading.left);
    expect(bookmarks.top).toBeGreaterThan(reading.top);

    await page.setViewportSize({ width: 900, height: 900 });
    const narrow = await extent("[aria-labelledby=settings-reading]");
    expect(Math.abs((narrow.left + narrow.right) / 2 - await pageCenter(page))).toBeLessThanOrEqual(1);
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
    // Cancelling and resetting at both ends of the window.
    const dialog = page.getByRole("dialog");
    const [cancel, confirm, box] = await Promise.all([
      dialog.getByRole("button", { name: "Annuler" }).boundingBox(),
      dialog.getByRole("button", { name: "Réinitialiser", exact: true }).boundingBox(),
      dialog.boundingBox(),
    ]);
    expect(cancel!.x - box!.x).toBeLessThan(40);
    expect(box!.x + box!.width - (confirm!.x + confirm!.width)).toBeLessThan(40);
    await dialog.getByRole("button", { name: "Annuler" }).click();
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
    // The headword as shown (« θελξί·νοος-ους, ») and as listed (« θελξίνοος-ους »).
    const bare = (word: string) => word.replace(/[·*]/g, "").replace(/[\s,:]+$/, "").trim();
    const words = new Set(PREVIEW_ENTRIES.map(entry => bare(entry.word)));
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text());
    });
    const seen = new Set<string>();
    for (let visit = 0; visit < 12 && seen.size < 2; visit++) {
      await goto("/préférences", { waitUntil: "hydration" });
      const word = bare((await page.getByRole("figure", { name: "Aperçu" }).locator(".entreea .grec").first().textContent())!);
      expect(words).toContain(word);
      seen.add(word);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });

  // Every weight the text uses (the headwords' 600 included) is drawn by the
  // reading font itself, not by the fonts after it: the same width whatever
  // the fallback (cf. the thin spaces' faces in fonts.css).
  test("reading: every weight drawn by the reading font", async ({ page, goto }) => {
    await goto("/préférences", { waitUntil: "hydration" });
    const fallbacks = await page.evaluate(async () => {
      const found: string[] = [];
      for (const family of ["Bailly Book", "GFS Didot", "GFS Artemisia", "GFS Bodoni", "GFS Neohellenic"]) {
        for (const style of ["normal", "italic"]) {
          for (const weight of ["400", "500", "600", "700"]) {
            const width = async (fallback: string): Promise<number> => {
              const font = `${style} ${weight} 100px "${family}", ${fallback}`;
              await document.fonts.load(font, "λόγος word");
              const span = document.createElement("span");
              span.style.font = font;
              span.style.whiteSpace = "pre";
              span.textContent = "λόγος word";
              document.body.append(span);
              const result = span.getBoundingClientRect().width;
              span.remove();
              return result;
            };
            if (Math.abs(await width("monospace") - await width("cursive")) > 0.5) found.push(`${family} ${style} ${weight}`);
          }
        }
      }
      return found;
    });
    expect(fallbacks).toEqual([]);
  });

  // Each entry keeps its lines whatever the font and weight (cf.
  // `previewEntries.ts`), and a line its height (cf. `.definition` in
  // components.css): the preview doesn't move when a setting changes.
  test("reading: the preview keeps its height whatever the font and weight", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goto("/préférences", { waitUntil: "hydration" });
    const variations = await page.evaluate(async (entries) => {
      const preview = document.querySelector("[aria-label=Aperçu]") as HTMLElement;
      const root = document.documentElement;
      const found: string[] = [];
      for (const entry of entries) {
        preview.innerHTML = entry.html;
        for (const size of ["small", "normal", "large", "larger"]) {
          const heights = new Set<number>();
          for (const font of ["book", "didot", "artemisia", "bodoni", "neohellenic"]) {
            for (const weight of ["normal", "bold"]) {
              Object.assign(root.dataset, { readingFont: font, readingSize: size, readingWeight: weight });
              await document.fonts.ready;
              heights.add(Math.round(preview.getBoundingClientRect().height));
            }
          }
          if (heights.size > 1) found.push(`${entry.uri} (${size}): ${[...heights].join(", ")}`);
        }
      }
      return found;
    }, PREVIEW_ENTRIES.map(({ uri, html }) => ({ uri, html })));
    expect(variations).toEqual([]);
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
