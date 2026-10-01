import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { bookmarksState, rootLength, seedBookmarks } from "./helpers";

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

  test("a tag's color, picked with the keyboard: the selected one focused, the arrows, its name shown", async ({ page }) => {
    await page.getByRole("button", { name: "Modifier l'étiquette « Vide »" }).click();
    const trigger = page.getByRole("button", { name: "Couleur de l'étiquette : vert" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const picker = page.getByRole("listbox", { name: "Couleur de l'étiquette" });
    await expect(picker.getByRole("option")).toHaveCount(10);
    await expect(picker.getByRole("option", { name: "vert", exact: true })).toBeFocused();
    await expect(picker.getByRole("option", { selected: true })).toHaveAccessibleName("vert");
    await expect(page.getByText("Vert", { exact: true })).toBeVisible();

    // The next hue; the name follows the focus; Enter picks it.
    await page.keyboard.press("ArrowRight");
    await expect(picker.getByRole("option", { name: "turquoise" })).toBeFocused();
    await expect(page.getByText("Turquoise", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(picker.getByRole("option", { name: "gris ardoise" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(picker).toBeHidden();
    const picked = page.getByRole("button", { name: "Couleur de l'étiquette : turquoise" });
    await expect(picked).toBeFocused();
    await expect(picked).toHaveAttribute("data-tag-color", "Teal");
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

  test("the excerpts follow the reading font, not its size nor its weight", async ({ page }) => {
    const excerpt = card(page, "Vocabulaire homérique").locator(".definition").first();
    await expect(excerpt).toHaveCSS("font-size", "15.5px");
    await page.evaluate(() => Object.assign(document.documentElement.dataset, { readingFont: "didot", readingSize: "larger", readingWeight: "bold" }));
    await expect(excerpt).toHaveCSS("font-family", /^"GFS Didot"/);
    await expect(excerpt).toHaveCSS("font-size", "15.5px");
    await expect(excerpt).toHaveCSS("font-weight", "400");
  });

  // A solid button keeps its pressed look while its menu or dialog is open
  // (`aria-expanded`).
  test("a solid button stays pressed while its menu is open", async ({ page }) => {
    const button = page.locator("main header aside button").filter({ hasText: "Fichier" });
    const look = () => button.evaluate(element => [getComputedStyle(element).backgroundImage, getComputedStyle(element).filter, getComputedStyle(element).backgroundColor]);
    await page.mouse.move(0, 0);
    const [restImage, , restColor] = await look();
    expect(restImage).toMatch(/gradient/);
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await look())[0]).toBe("none");
    // The next shade, opaque (not the former translucency).
    const [, , openColor] = await look();
    expect(openColor).not.toBe(restColor);
    expect(openColor).toMatch(/^rgb\(/);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await expect.poll(look).toEqual([restImage, "none", restColor]);
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

  test("centered under the header, which steps out of it evenly", async ({ page }) => {
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
    // The header steps out of the content by the search bar's overhangs.
    const overhang = await rootLength(page, "--search-overhang");
    expect(overhang).toBeGreaterThan(0);
    expect(Math.abs(content.left - inner.left - overhang)).toBeLessThan(1);
    expect(Math.abs(inner.right - content.right - overhang)).toBeLessThan(1);
  });

  // Where supported (e.g. Safari), the cards are laid out in lanes.
  test("cards in lanes where supported, on a grid otherwise", async ({ page }) => {
    const display = await page.locator("main section").evaluate(element => getComputedStyle(element).display);
    const lanes = await page.evaluate(() => CSS.supports("display", "grid-lanes"));
    expect(display).toBe(lanes ? "grid-lanes" : "grid");
  });
});

test.describe("bookmarks page, long groups", () => {
  // Added in this order: shown the latest first.
  const words = ["ἀγών", "βίος", "γένος", "δίκη", "ἔργον", "ζῷον", "ἦθος", "θεός", "ἵππος", "κόσμος"];
  const entry = (word: string, i: number) => ({ word, uri: `test-${i}`, excerpt: `${word}, exemple (${i})` });

  test.beforeEach(async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      tags: [
        { name: "Huit", color: "Green", entries: words.slice(0, 8).map(entry) },
        { name: "Dix", color: "Sky", entries: words.map(entry) },
      ],
    });
    await expect(card(page, "Dix")).toBeVisible();
  });

  test("from nine entries, the first six, then a button reveals the others", async ({ page }) => {
    // Eight: all shown, no button.
    await expect(card(page, "Huit").getByRole("link")).toHaveCount(8);
    await expect(card(page, "Huit").getByRole("button", { name: /^Voir/ })).toHaveCount(0);

    const links = card(page, "Dix").getByRole("link");
    const toggle = card(page, "Dix").getByRole("button", { name: "Voir les 4 autres" });
    await expect(links).toHaveCount(6);
    await expect(links.first()).toContainText("κόσμος");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const listId = await toggle.getAttribute("aria-controls");
    await expect(card(page, "Dix").locator(`[id="${listId}"]`)).toHaveCount(1);

    // From the keyboard: the focus goes to the first entry revealed.
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(links).toHaveCount(10);
    await expect(links.nth(6)).toBeFocused();
    await expect(links.nth(6)).toContainText("δίκη");
    const collapse = card(page, "Dix").getByRole("button", { name: "Réduire" });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");

    // Collapsed with the mouse, after scrolling past the card's top: the
    // button is brought back into view, under the header.
    await collapse.scrollIntoViewIfNeeded();
    await collapse.click();
    await expect(links).toHaveCount(6);
    await expect(toggle).toBeInViewport();
  });
});

test.describe("bookmarks page, table of contents", () => {
  const tagNames = ["Un", "Deux", "Trois", "Quatre", "Cinq"];

  test("from six tags: a link per group, with its count, to its card", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      starred: [logos],
      tags: tagNames.map(name => ({ name, color: "Sky" })),
    });
    // Five tags: no table of contents.
    await expect(card(page, "Cinq")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sommaire des signets" })).toHaveCount(0);

    await seedBookmarks(page, { tags: [{ name: "Six", color: "Rose", entries: [anax, menis] }] });
    const toc = page.getByRole("navigation", { name: "Sommaire des signets" });
    const links = toc.getByRole("link");
    // The favorites, then the tags in their order (the newest first).
    const names = ["Favoris, 1 entrée", "Six, 2 entrées", "Cinq, 0 entrée", "Quatre, 0 entrée", "Trois, 0 entrée", "Deux, 0 entrée", "Un, 0 entrée"];
    await expect(links).toHaveCount(names.length);
    for (const [i, name] of names.entries()) await expect(links.nth(i)).toHaveAccessibleName(name);

    await page.setViewportSize({ width: 1280, height: 600 });
    await links.filter({ hasText: /^Un/ }).click();
    await expect(page).toHaveURL(/#etiquette-[\w-]+$/);
    const target = page.locator("main section > .group").filter({ has: page.getByText("Un", { exact: true }) });
    await expect(target).toBeInViewport();
    // Under the sticky header.
    const [top, headerBottom] = await Promise.all([
      target.evaluate(element => element.getBoundingClientRect().top),
      page.locator("header").first().evaluate(element => element.getBoundingClientRect().bottom),
    ]);
    expect(top).toBeGreaterThanOrEqual(headerBottom);
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
