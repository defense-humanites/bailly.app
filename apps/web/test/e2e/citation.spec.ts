import { expect, test } from "@nuxt/test-utils/playwright";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// The entry's citation: in a window, from a button at the end of a card's
// toolbar (of homonyms, the card's: `index`).
const openCitation = async (page: Page, index = 0) => {
  await page.locator("main").getByRole("button", { name: "Citer", exact: true }).nth(index).click();
  return page.getByRole("dialog", { name: "Citer", exact: true });
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
    await expect(entryReference).toHaveText("(Bailly, 1895/2023, s. v. « λόγος »)");
    // Copied by its button (or a click on it), as the synchronization's key.
    await citation.getByRole("button", { name: "Copier la référence" }).first().click();
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("(Bailly, 1895/2023, s. v. « λόγος »)");

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
    const button = page.locator("main button[aria-label='Citer']").first();
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
    await expect(reference).toContainText("A. Bailly");
    // Once the window has stopped moving (its opening animation, which
    // lasts longer on a slow machine, as the CI's).
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished)));
    // Selected with the mouse, from the first letter to the eighth (on the
    // text itself): the click ending the selection copies nothing.
    const [from, to] = await reference.evaluate((element) => {
      const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
      const rect = (start: number): DOMRect => {
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + 1);
        return range.getBoundingClientRect();
      };
      const [first, eighth] = [rect(0), rect(7)];
      return [{ x: first.left + 1, y: first.top + first.height / 2 }, { x: eighth.right - 1, y: eighth.top + eighth.height / 2 }];
    });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => getSelection()!.toString().length)).toBeGreaterThan(0);
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toHaveCount(0);
    // A click elsewhere (the selection given up) copies it all.
    const box = (await reference.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await expect(citation.getByRole("button", { name: "Référence copiée" })).toBeVisible();
  });

  test("as a BibLaTeX record: copied, or downloaded as a file", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await goto("/logades", { waitUntil: "hydration" });
    const citation = await openCitation(page, 1);
    // In its own tab, for LaTeX or a reference manager.
    await expect(citation.locator("pre")).toHaveCount(0);
    await citation.getByRole("tab", { name: "LaTeX et Zotero" }).click();
    const record = citation.locator("pre");
    await expect(record).toContainText("@inreference{bailly:logades-2,");
    await expect(record).toContainText("url         = {https://bailly.app/logades#2},");

    await citation.getByRole("button", { name: "Copier l'entrée BibLaTeX" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^@inreference\{bailly:logades-2,\n[^]*\n\}$/);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      citation.getByRole("button", { name: "Télécharger le fichier BibLaTeX" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("bailly-logades-2.bib");
    const text = readFileSync(await download.path(), "utf8");
    expect(text).toMatch(/^@inreference\{bailly:logades-2,[^]*\}\n$/);

    // Or the dictionary itself, a choice kept on the device.
    await citation.getByRole("combobox", { name: "Objet de l'entrée BibLaTeX" }).click();
    await page.getByRole("option", { name: "L'ouvrage" }).click();
    await expect(record).toContainText("@book{bailly,");
    const [workDownload] = await Promise.all([
      page.waitForEvent("download"),
      citation.getByRole("button", { name: "Télécharger le fichier BibLaTeX" }).click(),
    ]);
    expect(workDownload.suggestedFilename()).toBe("bailly.bib");
    // Reopened in the last tab opened.
    await page.reload();
    await expect((await openCitation(page)).locator("pre")).toContainText("@book{bailly,");
  });

  test("an entry's page described for the reference managers (Zotero)", async ({ page, goto }) => {
    // In the page served (Zotero's connector reads it as it is).
    await goto("/logos", { waitUntil: "hydration" });
    const html = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(html).toContain("<meta name=\"z.itemType\" content=\"dictionaryEntry\">");
    expect(html).toContain("<meta name=\"citation_title\" content=\"λόγος\">");
    expect(html).toContain("<meta name=\"prism.publicationName\" content=\"Dictionnaire grec-français\">");
  });

  test("the other pages described as the dictionary itself (a book, for Zotero)", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    for (const path of ["/", "/signets"]) {
      const html = await page.evaluate(async url => (await fetch(url)).text(), path);
      expect(html).toContain("<meta name=\"z.itemType\" content=\"book\">");
      expect(html).toContain("<meta name=\"citation_title\" content=\"Dictionnaire grec-français\">");
      expect(html).toContain("<meta name=\"citation_public_url\" content=\"https://bailly.app\">");
    }
    // An entry's page: the entry's only.
    const entry = await page.evaluate(async () => (await fetch("/logos")).text());
    expect(entry.match(/name="z\.itemType"/g)).toHaveLength(1);
    expect(entry).toContain("<meta name=\"citation_public_url\" content=\"https://bailly.app/logos\">");
  });

  test("on the home page's random entry", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await opening.getByRole("button", { name: "Citer", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Citer", exact: true }).getByText("https://bailly.app/", { exact: false }).first()).toBeVisible();
  });
});
