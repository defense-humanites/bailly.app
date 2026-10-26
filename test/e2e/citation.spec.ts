import { expect, test } from "@nuxt/test-utils/playwright";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// The entry's citation: in a window, from a button at the end of a card's
// toolbar (of homonyms, the card's: `index`).
const openCitation = async (page: Page, index = 0) => {
  await page.locator("main").getByRole("button", { name: "Citer cette entrée" }).nth(index).click();
  return page.getByRole("dialog", { name: "Citer cette entrée" });
};

test.describe("citing an entry", () => {
  test("the forms, the bibliography's style, a copy", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logos", { waitUntil: "hydration" });
    let citation = await openCitation(page);
    const entryReference = citation.locator("section p").first();
    await expect(entryReference).toContainText("s. v. « λόγος », https://bailly.app/logos (consulté le");

    await citation.getByRole("combobox", { name: "Forme de la référence" }).click();
    await page.getByRole("option", { name: "Auteur-date" }).click();
    await expect(entryReference).toHaveText("(Bailly, 1894/2023, s. v. « λόγος »)");
    // Copied by its button (or a click on it), as the synchronization's key.
    await citation.getByRole("button", { name: "Copier la référence" }).first().click();
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("(Bailly, 1894/2023, s. v. « λόγος »)");

    // Author-date follows the bibliography's style; both choices kept.
    await citation.getByRole("combobox", { name: "Norme de la bibliographie" }).click();
    await page.getByRole("option", { name: "ISO 690" }).click();
    await expect(entryReference).toHaveText("(Bailly, 2023 : s. v. « λόγος »)");
    await expect(citation.getByText("Suit la norme choisie pour la bibliographie, ci-dessous : ISO 690.")).toBeVisible();
    // The style's name in the mention opens the style's list.
    await citation.getByRole("button", { name: "ISO 690", exact: true }).click();
    await page.getByRole("option", { name: "ISO 690" }).click();
    await expect(citation.locator("section p").nth(1)).toContainText("BAILLY, Anatole.");
    await page.reload();
    citation = await openCitation(page);
    await expect(citation.getByRole("combobox", { name: "Forme de la référence" })).toContainText("Auteur-date");
    await expect(citation.locator("section p").nth(1)).toContainText("BAILLY, Anatole.");
  });

  test("its window mounted on opening, the focus back on its button once closed", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // (By its attributes: the page is hidden from the accessibility tree
    // while the window is open.)
    const button = page.locator("main button[aria-label='Citer cette entrée']").first();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const citation = await openCitation(page);
    await expect(citation).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(citation).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    // Opened again, the window already mounted.
    await expect(await openCitation(page)).toBeVisible();
  });

  test("a homonym cited with its number after the headword, from its own card", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto("/logades", { waitUntil: "hydration" });
    await expect((await openCitation(page, 1)).locator("section p").first())
      .toContainText("« λογάδες² », https://bailly.app/logades#2");
    await page.keyboard.press("Escape");
    await expect((await openCitation(page, 0)).locator("section p").first())
      .toContainText("« λογάδες¹ », https://bailly.app/logades#1");
  });

  test("at every width, from the card's top", async ({ page, goto }) => {
    for (const width of [390, 1150, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await goto("/logos", { waitUntil: "hydration" });
      const dialog = await openCitation(page);
      await expect(dialog.getByText("Bailly, A. (2023).", { exact: false })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("a part of a reference selected, not the whole copied", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logos", { waitUntil: "hydration" });
    const citation = await openCitation(page);
    const reference = citation.locator("section p").first();
    // Selected with the mouse: the click ending the selection copies nothing.
    const box = (await reference.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => getSelection()!.toString().length)).toBeGreaterThan(0);
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toHaveCount(0);
    // A click elsewhere (the selection given up) copies it all.
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toBeVisible();
  });

  test("as a BibLaTeX record: copied, or downloaded as a file", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logades", { waitUntil: "hydration" });
    const citation = await openCitation(page, 1);
    const record = citation.locator("pre");
    await expect(record).toContainText("@inreference{bailly:logades-2,");
    await expect(record).toContainText("url         = {https://bailly.app/logades#2},");
    // Its height bounded, scrolled (by the keyboard too).
    expect(await record.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await record.focus();
    await page.keyboard.press("End");
    await expect.poll(() => record.evaluate(element => element.scrollTop)).toBeGreaterThan(0);

    await citation.getByRole("button", { name: "Copier l'entrée BibLaTeX" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^@inreference\{bailly:logades-2,\n[^]*\n\}$/);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      citation.getByRole("button", { name: "Télécharger le fichier BibLaTeX" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("bailly-logades-2.bib");
    const text = readFileSync(await download.path(), "utf8");
    expect(text).toMatch(/^@inreference\{bailly:logades-2,[^]*\}\n$/);
  });

  test("an entry's page described for the reference managers (Zotero)", async ({ page, goto }) => {
    // In the page served (Zotero's connector reads it as it is).
    await goto("/logos", { waitUntil: "hydration" });
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toContain("<meta name=\"z.itemType\" content=\"dictionaryEntry\">");
    expect(html).toContain("<meta name=\"citation_title\" content=\"λόγος\">");
    expect(html).toContain("<meta name=\"prism.publicationName\" content=\"Dictionnaire grec-français\">");
  });

  test("on the home page's random entry", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await opening.getByRole("button", { name: "Citer cette entrée" }).click();
    await expect(page.getByRole("dialog", { name: "Citer cette entrée" }).getByText("https://bailly.app/", { exact: false }).first()).toBeVisible();
  });
});
