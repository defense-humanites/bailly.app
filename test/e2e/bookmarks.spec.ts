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

  test("tags: by name (none pinned), a long name inside its card", async ({ page }) => {
    expect((await bookmarksState(page)).tags).toEqual(["Vide", "Vocabulaire homérique et tragique"]);
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

  // As for a new tag: a name taken told on the field, which keeps it and the
  // focus on Enter; Escape gives it up.
  test("renaming a tag: a taken name told on the field", async ({ page }) => {
    await page.getByRole("button", { name: "Modifier l'étiquette « Vide »" }).click();
    const name = card(page, "Vide").getByRole("textbox", { name: "Nom de l'étiquette" });
    // One field, the color included: its ring goes round both.
    const field = name.locator("..");
    await expect(field.getByRole("button", { name: /^Couleur de l'étiquette/ })).toBeVisible();
    await expect(field).toHaveCSS("box-shadow", "none");
    await name.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(field).not.toHaveCSS("box-shadow", "none");
    await name.fill("vocabulaire homerique et tragique");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(field).not.toHaveCSS("box-shadow", "none");
    await expect(name).toHaveAccessibleDescription("L'étiquette « Vocabulaire homérique et tragique » existe déjà.");
    await expect(page.locator("[data-slot=content]").getByText("existe déjà")).toBeVisible();
    await name.press("Enter");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("vocabulaire homerique et tragique");
    await name.fill("");
    await name.press("Enter");
    await expect(name).toHaveAccessibleDescription("Une étiquette doit être nommée.");
    await name.press("Escape");
    await expect(name).toHaveValue("Vide");
    expect((await bookmarksState(page)).tags).toEqual(["Vide", "Vocabulaire homérique et tragique"]);
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

  test("a description: added in the edit mode, shown under the name, removed with an undo", async ({ page }) => {
    const group = card(page, "Vocabulaire homérique");
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Vocabulaire homérique et tragique »" });
    const height = () => group.evaluate(element => element.getBoundingClientRect().height);

    // Without a description: nothing is shown, and, in the edit mode, a link
    // in its place adds one; Escape cancels it.
    await edit.click();
    await group.getByRole("button", { name: "Ajouter une description" }).click();
    await group.getByRole("textbox", { name: "Description de l'étiquette" }).fill("Brouillon");
    await page.keyboard.press("Escape");
    await expect(group.getByRole("textbox", { name: "Description de l'étiquette" })).toHaveCount(0);
    await expect(group.getByRole("button", { name: "Ajouter une description" })).toBeVisible();
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

    // Escape cancels a change.
    await field.fill("Autre");
    await field.press("Escape");
    await expect(field).toHaveValue("Pour l'examen\nde mardi.");

    // Removed (its clear button, or emptied): told, and it can come back.
    await group.getByRole("button", { name: "Supprimer la description" }).click();
    await expect(group.getByRole("textbox", { name: "Description de l'étiquette" })).toHaveCount(0);
    await page.getByRole("button", { name: "Annuler" }).click();
    // (The click in the toast, out of the card, left the edit mode.)
    await expect(edit).toHaveAttribute("aria-pressed", "false");
    await expect(group.getByText(/Pour l'examen\s+de mardi\./)).toBeVisible();
    await edit.click();
    await field.fill("");
    await field.press("Enter");
    await expect(page.getByText("Description supprimée").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(group.getByText("Pour l'examen")).toHaveCount(0);
  });

  test("a long name: on one line in the edit mode, the card keeping its height", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const group = card(page, "Vocabulaire homérique");
    const height = () => group.evaluate(element => element.getBoundingClientRect().height);
    const before = await height();

    // Without a description, the card grows by the line of « Ajouter une
    // description » only.
    await page.getByRole("button", { name: "Modifier l'étiquette « Vocabulaire homérique et tragique »" }).click();
    const name = group.getByRole("textbox", { name: "Nom de l'étiquette" });
    await expect(name).toHaveValue("Vocabulaire homérique et tragique");
    expect(await name.evaluate(element => element.getBoundingClientRect().height)).toBe(32);
    const add = (await group.getByRole("button", { name: "Ajouter une description" }).boundingBox())!;
    expect(await height()).toBeCloseTo(before + add.height + 4, 0);
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
  test("a solid button stays pressed while its window is open", async ({ page }) => {
    // The synchronization, off: a solid button (once its state is loaded).
    // (Not by its role: the open dialog hides the page from the accessibility
    // tree.)
    const button = page.locator("main header button[aria-label^=Synchronisation]");
    const look = () => button.evaluate(element => [getComputedStyle(element).backgroundImage, getComputedStyle(element).filter, getComputedStyle(element).backgroundColor]);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await look())[0]).toMatch(/gradient/);
    // Its color reached (from the calm look shown until then).
    await expect.poll(async () => (await look())[2]).toMatch(/^rgb\(/);
    const [restImage, , restColor] = await look();
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await look())[0]).toBe("none");
    // The next shade (once its transition is over), opaque (not the former
    // translucency).
    await expect.poll(async () => (await look())[2]).not.toBe(restColor);
    expect((await look())[2]).toMatch(/^rgb\(/);
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await expect.poll(look).toEqual([restImage, "none", restColor]);
  });

  // No submit button: Enter adds the tag, as the key drawn in the field says.
  test("creating a tag with Enter, its hint named", async ({ page }) => {
    const field = page.getByRole("textbox", { name: "Nom de la nouvelle étiquette" });
    await expect(field).toHaveAccessibleDescription(/^Entrée pour ajouter/);
    await expect(field).toHaveAttribute("enterkeyhint", "done");
    await field.fill("Pindare");
    await field.press("Enter");
    await expect(card(page, "Pindare")).toBeVisible();
    await expect(field).toHaveValue("");
    expect((await bookmarksState(page)).tags).toContain("Pindare");
  });

  // The error where the eyes are: on the field, as soon as the name is taken
  // (case and diacritics ignored) or reserved; gone once it changes.
  test("creating a tag: a taken name told on the field, before Enter", async ({ page }) => {
    const field = page.getByRole("textbox", { name: "Nom de la nouvelle étiquette" });
    await field.fill("vidé");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/L'étiquette « Vide » existe déjà\./);
    await expect(page.locator("[data-slot=content]").getByText("L'étiquette « Vide » existe déjà.")).toBeVisible();
    await field.press("Enter");
    await expect(field).toHaveValue("vidé");
    expect((await bookmarksState(page)).tags).toHaveLength(2);
    await field.fill("Favoris");
    await expect(field).toHaveAccessibleDescription(/réservé à la liste des favoris/);
    await field.fill("Vides");
    await expect(field).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("[data-slot=content]")).toHaveCount(0);
  });

  test("the active tag: marked on its card, chosen from another card", async ({ page }) => {
    const vide = card(page, "Vide");
    const vocabulaire = card(page, "Vocabulaire homérique");
    // The newest tag is the active one.
    await expect(vocabulaire.getByText("active", { exact: true })).toBeVisible();
    await expect(vocabulaire.getByRole("button", { name: /^Rendre active/ })).toHaveCount(0);
    await expect(vide.getByText("active", { exact: true })).toHaveCount(0);

    await vide.getByRole("button", { name: "Rendre active l'étiquette « Vide »" }).click();
    await expect(vide.getByText("active", { exact: true })).toBeVisible();
    await expect(vocabulaire.getByText("active", { exact: true })).toHaveCount(0);
    await expect(vocabulaire.getByRole("button", { name: "Rendre active l'étiquette « Vocabulaire homérique et tragique »" })).toBeAttached();
    // Not on the favorites.
    await expect(card(page, "Favoris").getByRole("button", { name: /^Rendre active/ })).toHaveCount(0);

    // Or from the header's menu.
    const menu = page.getByRole("group", { name: "Étiquettes" }).getByRole("button", { name: "Étiquette active" });
    await expect(menu).toContainText("Vide");
    await menu.click();
    await page.getByRole("option", { name: "Vocabulaire homérique et tragique" }).click();
    await expect(vocabulaire.getByText("active", { exact: true })).toBeVisible();
    await expect(menu).toContainText("Vocabulaire homérique et tragique");
  });

  test("removing a favorite", async ({ page }) => {
    await page.getByRole("button", { name: "Modifier les favoris" }).click();
    await page.getByRole("button", { name: "Retirer « λόγος » des favoris" }).click();
    await expect.poll(async () => (await bookmarksState(page)).starred).toBe(0);
  });

  // The edit button toggles the mode from the same place, in the corner.
  test("the edit button stays in its corner in both modes", async ({ page }) => {
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Vide »" });
    const before = (await edit.boundingBox())!;
    await edit.click();
    await expect(edit).toHaveAttribute("aria-pressed", "true");
    const after = (await edit.boundingBox())!;
    expect([after.x, after.y]).toEqual([before.x, before.y]);
  });

  test("edit buttons: on hover or focus, not at rest", async ({ page }) => {
    const actions = card(page, "Vide").getByRole("button", { name: /^(Épingler|Rendre active|Modifier) l'étiquette « Vide »$/ });
    await page.mouse.move(0, 0);
    await expect(actions).toHaveCount(3);
    for (const action of await actions.all()) await expect(action).toHaveCSS("opacity", "0");
    await card(page, "Vide").hover();
    for (const action of await actions.all()) await expect(action).toHaveCSS("opacity", "1");
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
        { name: "Six", color: "Green", entries: words.slice(0, 6).map(entry) },
        { name: "Sept", color: "Rose", entries: words.slice(0, 7).map(entry) },
        { name: "Dix", color: "Sky", entries: words.map(entry) },
      ],
    });
    await expect(card(page, "Dix")).toBeVisible();
  });

  test("from seven entries, the first six, then a button reveals the others", async ({ page }) => {
    // Eight: all shown, no button.
    // Six: all shown, no button; seven: the seventh behind « Voir l’autre ».
    await expect(card(page, "Six").getByRole("link")).toHaveCount(6);
    await expect(card(page, "Six").getByRole("button", { name: /^Voir/ })).toHaveCount(0);
    await expect(card(page, "Sept").getByRole("link")).toHaveCount(6);
    await expect(card(page, "Sept").getByRole("button", { name: "Voir l’autre" })).toBeVisible();

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

test.describe("bookmarks page, pinning and scrolling", () => {
  // The page follows a tag pinned (to the top), not one unpinned.
  test("a tag pinned is followed, a tag unpinned left to go", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      tags: Array.from({ length: 12 }, (_, i) => ({ name: `Étiquette ${String(i + 1).padStart(2, "0")}`, color: "Sky", entries: [logos] })),
    });
    const last = card(page, "Étiquette 12");
    await last.scrollIntoViewIfNeeded();
    const pin = page.getByRole("button", { name: "Épingler l'étiquette « Étiquette 12 »" });
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    // Followed: under the header and the table of contents, at the top.
    await expect.poll(() => last.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeLessThan(250);
    await expect(last).toBeInViewport();
    // Pointed out, as from the table of contents.
    await expect(last).toHaveAttribute("data-card-highlight", "");

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(last).not.toBeInViewport();
  });
});

test.describe("bookmarks page, quotas", () => {
  // The number of tags in the new tag field, with the quota; beyond it, told
  // on the field.
  test("the tags' quota in the new tag field", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Un", color: "Sky" }, { name: "Deux", color: "Rose" }] });
    const field = page.getByRole("textbox", { name: "Nom de la nouvelle étiquette" });
    await expect(page.getByText("2/50", { exact: true })).toBeVisible();
    await expect(field).toHaveAccessibleDescription(/\(2 étiquettes sur 50 au plus\)/);
  });
});

test.describe("bookmarks page, sorting and pinning", () => {
  // The cards' names, in order (the favorites first).
  const cardNames = (page: Page) => page.locator("main section > .group").evaluateAll(cards =>
    cards.map(card => card.querySelector("[data-slot=header] span.font-bold")?.firstChild?.textContent?.trim() ?? "Favoris"));

  test("the tags sorted as chosen on the device, the pinned ones first", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    // Created in this order, Gamma's entry added last.
    await seedBookmarks(page, {
      tags: [
        { name: "Bêta", color: "Rose", entries: [anax, menis] },
        { name: "Alpha", color: "Green" },
        { name: "Gamma", color: "Sky", entries: [logos] },
      ],
    });
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Alpha", "Bêta", "Gamma"]);

    const sortBy = async (label: string): Promise<void> => {
      await page.getByRole("button", { name: "Trier" }).click();
      await page.getByRole("menuitemcheckbox", { name: label, exact: true }).click();
    };
    await sortBy("Par nombre d'entrées");
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Bêta", "Gamma", "Alpha"]);
    await sortBy("Par ajout récent");
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Gamma", "Alpha", "Bêta"]);
    await page.getByRole("button", { name: "Trier" }).click();
    await expect(page.getByRole("menuitemcheckbox", { name: "Par ajout récent" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    // Kept on the device.
    await page.reload();
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Gamma", "Alpha", "Bêta"]);

    // A pinned tag comes first, whatever the sorting; a pin is its icon (on
    // its card and in the table of contents). The edit button comes last.
    const pin = page.getByRole("button", { name: "Épingler l'étiquette « Bêta »" });
    const beta = page.locator("main section > .group").filter({ hasText: "Bêta" });
    await expect(beta.locator("[data-slot=header] button").last()).toHaveAccessibleName("Modifier l'étiquette « Bêta »");
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Bêta", "Gamma", "Alpha"]);
    await expect(beta.locator("[data-slot=header] .iconify.i-bailly\\:pin-filled").first()).toBeVisible();
    await sortBy("Par nom");
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Bêta", "Alpha", "Gamma"]);
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => cardNames(page)).toEqual(["Favoris", "Alpha", "Bêta", "Gamma"]);
  });
});

test.describe("bookmarks page, table of contents", () => {
  const tagNames = ["Un", "Deux", "Trois"];

  test("from four tags: a link per group, with its count, to its card", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      starred: [logos],
      tags: tagNames.map(name => ({ name, color: "Sky" })),
    });
    // Three tags: no table of contents.
    await expect(card(page, "Trois")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sommaire des signets" })).toHaveCount(0);

    await seedBookmarks(page, { tags: [{ name: "Quatre", color: "Rose", entries: [anax, menis] }] });
    const toc = page.getByRole("navigation", { name: "Sommaire des signets" });
    const links = toc.getByRole("link");
    // The favorites, then the tags in their order (by name, none pinned).
    const names = ["Favoris, 1 entrée", "Deux, 0 entrée", "Quatre, 2 entrées, étiquette active", "Trois, 0 entrée", "Un, 0 entrée"];
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

  // Sticky under the header, on one row; the link followed marks its group
  // as being read, and scrolling marks the one under the table of contents.
  test("sticky on one row, the group being read marked", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await goto("/signets", { waitUntil: "hydration" });
    const names = Array.from({ length: 24 }, (_, i) => `Étiquette numéro ${i + 1}`);
    await seedBookmarks(page, {
      starred: [logos],
      tags: names.map(name => ({ name, color: "Sky", entries: [anax] })),
    });
    const toc = page.getByRole("navigation", { name: "Sommaire des signets" });
    const box = await toc.boundingBox();
    // One row, which overflows: it scrolls sideways.
    expect(box!.height).toBe(48);
    expect(await toc.locator("ul").evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);

    // A vertical wheel over the row scrolls the page, not the row.
    await toc.hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await toc.locator("ul").evaluate(element => element.scrollLeft)).toBe(0);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    const target = toc.getByRole("link", { name: /^Étiquette numéro 12,/ });
    await target.click();
    await expect(target).toHaveAttribute("aria-current", "location");
    await expect(toc.locator("[aria-current]")).toHaveCount(1);
    // Stuck under the header, its link in sight, the card under it.
    const headerBottom = await page.locator("header").first().evaluate(element => element.getBoundingClientRect().bottom);
    await expect.poll(async () => (await toc.boundingBox())!.y).toBeCloseTo(headerBottom, 0);
    await expect(target).toBeInViewport({ ratio: 1 });
    // Its card outlined for a moment.
    await expect(card(page, "Étiquette numéro 12")).toHaveAttribute("data-card-highlight", "");
    await expect(card(page, "Étiquette numéro 12")).not.toHaveAttribute("data-card-highlight");
    // The mark slides under its link.
    await expect.poll(async () => {
      const [mark, link] = await Promise.all([toc.locator("[data-toc-mark]").boundingBox(), target.boundingBox()]);
      return Math.round(mark!.x + mark!.width / 2 - (link!.x + link!.width / 2));
    }).toBe(0);
    const cardTop = await card(page, "Étiquette numéro 12").evaluate(element => element.getBoundingClientRect().top);
    expect(cardTop).toBeGreaterThanOrEqual(headerBottom + 48);

    // Scrolling back to the top: the favorites are being read.
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -100000);
    await expect(toc.getByRole("link", { name: /^Favoris/ })).toHaveAttribute("aria-current", "location");
  });

  // On a narrow window with a mouse too, arrows scroll the row.
  test("arrows on a narrow window", async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      tags: Array.from({ length: 8 }, (_, i) => ({ name: `Étiquette numéro ${i + 1}`, color: "Sky" })),
    });
    const toc = page.getByRole("navigation", { name: "Sommaire des signets" });
    const [previous, next] = [toc.locator("button").first(), toc.locator("button").last()];
    await expect(next).toBeVisible();
    await expect(previous).toBeHidden();
    await next.click();
    await expect.poll(() => toc.locator("ul").evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expect(previous).toBeVisible();
  });

  // Scrolling the page, the row follows the group being read; with reduced
  // motion, it never moves by itself.
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`the row follows the reading (${reducedMotion})`, async ({ page, goto }) => {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 1280, height: 600 });
      await goto("/signets", { waitUntil: "hydration" });
      await seedBookmarks(page, {
        tags: Array.from({ length: 24 }, (_, i) => ({ name: `Étiquette numéro ${i + 1}`, color: "Sky", entries: [anax] })),
      });
      const toc = page.getByRole("navigation", { name: "Sommaire des signets" });
      // The cards loaded (the page as long as it gets) before scrolling.
      await expect(card(page, "Étiquette numéro 24")).toBeAttached();
      await page.mouse.move(640, 400);
      await page.mouse.wheel(0, 100000);
      // The last cards (by name, numbers by value): 21 to 24.
      await expect(toc.locator("[aria-current=location]")).toHaveAccessibleName(/^Étiquette numéro 2[1-4],/);
      const row = toc.locator("ul");
      if (reducedMotion === "reduce") {
        await page.waitForTimeout(500);
        expect(await row.evaluate(element => element.scrollLeft)).toBe(0);
      } else {
        await expect(toc.locator("[aria-current]")).toBeInViewport({ ratio: 1 });
        expect(await row.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
    });
  }
});

test.describe("bookmarks page on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("edit buttons always shown, entries on one column", async ({ page, goto }) => {
    await goto("/signets", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: [{ name: "Homère", color: "Blue", entries: [anax, menis] }] });
    const edit = page.getByRole("button", { name: "Modifier l'étiquette « Homère »" });
    await expect(edit).toHaveCSS("opacity", "1");
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
