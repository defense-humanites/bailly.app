import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { bookmarksState, seedBookmarks } from "./helpers";

// Real entries (their excerpts come from the Bailly).
const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };
const anax = { word: "ἄναξ", uri: "anax", excerpt: "ἄναξ, gén. ἄνακτος (ὁ) [ᾰν] maître, chef, roi : 1 en parl. des dieux, particul. d’Apollon, avec ou sans Ἀπόλλων : ἄναξ Ἄπολλον, Eschl. Ag. 513, etc. …" };
const menis = { word: "μῆνις", uri: "mênis", excerpt: "μῆνις, ιος, postér. ιδος (ἡ) colère durable, ressentiment, Il. 1, 1, etc. ; Od. 3, 135, etc. ; Eschl. Eum. 314 ; Soph. Aj. 656, etc. ; Hdt. 7, 137, 1…" };

const card = (page: Page, name: string) => page.locator("main section > .group").filter({ hasText: name });

test.describe("bookmarks page", () => {
  test.beforeEach(async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      starred: [logos],
      tags: [
        { name: "Vide", color: "Green" },
        { name: "Vocabulaire homérique et tragique", color: "Sky", entries: [anax, menis] },
      ],
    });
    await expect(card(page, "Vocabulaire homérique")).toBeVisible();
  });

  test("tags: the newest first, a long name inside its card", async ({ page }) => {
    expect((await bookmarksState(page)).tags).toEqual(["Vocabulaire homérique et tragique", "Vide"]);
    const header = card(page, "Vocabulaire homérique").locator("[data-slot=header]");
    const inside = await header.evaluate((element) => {
      const name = [...element.querySelectorAll("span")].find(span => span.textContent.includes("Vocabulaire"))!;
      return name.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 0.5;
    });
    expect(inside).toBe(true);
  });

  test("editing with the keyboard: rename, delete after a confirmation", async ({ page }) => {
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Vide »" });
    await edit.focus();
    await page.keyboard.press("Enter");
    await expect(edit).toHaveAttribute("aria-pressed", "true");
    const name = card(page, "Vide").getByRole("textbox", { name: "Nom de l'étiquette" });
    await name.fill("Vide renommée");
    await name.press("Enter");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await bookmarksState(page)).tags).toContain("Vide renommée");

    const homer = page.getByRole("button", { name: "Modifier l'étiquette « Vocabulaire homérique et tragique »" });
    await homer.click();
    await page.getByRole("button", { name: "Supprimer l'étiquette « Vocabulaire homérique et tragique »" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Les 2 entrées qu'elle référence ne seront plus étiquetées ainsi.");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect((await bookmarksState(page)).tags).toContain("Vocabulaire homérique et tragique");
    await page.getByRole("button", { name: "Supprimer l'étiquette « Vocabulaire homérique et tragique »" }).click();
    await dialog.getByRole("button", { name: "Supprimer" }).click();
    await expect.poll(async () => await bookmarksState(page)).toMatchObject({ tagged: 0 });
  });

  test("a description: added in the edit mode, shown under the name, the card keeping its size", async ({ page }) => {
    const group = card(page, "Vocabulaire homérique");
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Vocabulaire homérique et tragique »" });
    const height = () => group.evaluate(element => element.getBoundingClientRect().height);

    // Without a description: nothing is shown, and a button adds one.
    await edit.click();
    await group.getByRole("button", { name: "Ajouter une description" }).click();
    const field = group.getByRole("textbox", { name: "Description de l'étiquette" });
    await expect(field).toBeFocused();
    await field.fill("Pour l'examen");
    await field.press("Shift+Enter"); // A line break.
    await field.pressSequentially("de mardi.");
    await field.press("Enter"); // Validates.
    await page.keyboard.press("Escape");
    await expect(group.getByText(/Pour l'examen\s+de mardi\./)).toBeVisible();
    await expect(group.getByRole("button", { name: "Ajouter une description" })).toHaveCount(0);

    // The edit mode keeps the size of the card (the fields replace the texts).
    const before = await height();
    await edit.click();
    await expect(field).toHaveValue("Pour l'examen\nde mardi.");
    expect(await height()).toBe(before);

    // Emptied: the description goes.
    await field.fill("");
    await page.keyboard.press("Escape");
    await expect(group.getByText("Pour l'examen")).toHaveCount(0);
  });

  test("a long name: on one line in the edit mode, the card keeping its height", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const group = card(page, "Vocabulaire homérique");
    const height = () => group.evaluate(element => element.getBoundingClientRect().height);
    const before = await height();

    // Without a description: « Ajouter une description » does not rewrap the name.
    await page.getByRole("button", { name: "Modifier l'étiquette « Vocabulaire homérique et tragique »" }).click();
    const name = group.getByRole("textbox", { name: "Nom de l'étiquette" });
    await expect(name).toHaveValue("Vocabulaire homérique et tragique");
    expect(await name.evaluate(element => element.getBoundingClientRect().height)).toBe(32);
    expect(await height()).toBe(before);
  });

  test("an empty tag: its text aligned with the name", async ({ page }) => {
    const [name, text] = await card(page, "Vide").evaluate((element) => {
      const left = (node: Node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().left;
      };
      const title = [...element.querySelectorAll("[data-slot=header] span")].find(span => span.textContent.trim() === "Vide")!;
      return [left(title), left(element.querySelector("[data-slot=body] p")!)];
    });
    expect(text).toBeCloseTo(name, 0);
  });

  test("removing a favorite", async ({ page }) => {
    await page.getByRole("button", { name: "Modifier les favoris" }).click();
    await page.getByRole("button", { name: "Retirer « λόγος » des favoris" }).click();
    await expect.poll(async () => (await bookmarksState(page)).starred).toBe(0);
  });

  test("arranging the tags with the keyboard", async ({ page }) => {
    await page.getByRole("button", { name: "Arranger" }).click();
    const down = page.getByRole("button", { name: "Descendre « Vocabulaire homérique et tragique »" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await bookmarksState(page)).tags).toEqual(["Vide", "Vocabulaire homérique et tragique"]);
    await expect(page.getByRole("dialog").locator("[aria-live=polite]")).toHaveText("« Vocabulaire homérique et tragique » est en position 2 sur 2.");
  });

  test("edit buttons: on hover or focus, not at rest", async ({ page }) => {
    const actions = page.getByRole("button", { name: "Modifier l'étiquette « Vide »" }).locator("..");
    await page.mouse.move(0, 0);
    await expect(actions).toHaveCSS("opacity", "0");
    await card(page, "Vide").hover();
    await expect(actions).toHaveCSS("opacity", "1");
  });

  test("aligned with the header", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { content, inner } = await page.evaluate(() => {
      const edges = (element: Element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
          right: box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        };
      };
      return { content: edges(document.querySelector("main section")!), inner: edges(document.querySelector("header > nav")!) };
    });
    expect(Math.abs(content.left - inner.left)).toBeLessThan(1);
    expect(Math.abs(content.right - inner.right)).toBeLessThan(1);
  });

  // Where supported (e.g. Safari), the cards are laid out in lanes.
  test("cards in lanes where supported, on a grid otherwise", async ({ page }) => {
    const display = await page.locator("main section").evaluate(element => getComputedStyle(element).display);
    const lanes = await page.evaluate(() => CSS.supports("display", "grid-lanes"));
    expect(display).toBe(lanes ? "grid-lanes" : "grid");
  });
});

test.describe("bookmarks page on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("edit buttons always shown, entries on one column", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Homère", color: "Blue", entries: [anax, menis] }] });
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Homère »" });
    await expect(edit.locator("..")).toHaveCSS("opacity", "1");
    const columns = await card(page, "Homère").locator("[data-slot=body] .grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(1);
    await edit.tap();
    await page.getByRole("button", { name: "Retirer « ἄναξ » de l'étiquette « Homère »" }).tap();
    await expect.poll(async () => (await bookmarksState(page)).tagged).toBe(1);
  });
});

test("bookmarks page, server-rendered: placeholders until IndexedDB is loaded", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL("/signets", baseURL).href);
  await expect(page.locator("main section")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("main .animate-pulse")).toHaveCount(2);
  await context.close();
});
