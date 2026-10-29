import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { seedBookmarks, tagNamesOf } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };

const allTags = (page: Page) => page.getByRole("dialog", { name: "Toutes les étiquettes" });

test.describe("the tags of an entry", () => {
  test("its list fetched once the page is ready, before the panel opens", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // (Seeding reloads the page.)
    await seedBookmarks(page, { tags: [{ name: "Vert", color: "Green", entries: [logos] }], current: "Vert" });
    await page.waitForLoadState("networkidle");
    const scripts: string[] = [];
    page.on("request", request => request.resourceType() === "script" && scripts.push(request.url()));
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    await expect(allTags(page).getByRole("option", { name: "Vert" })).toBeVisible();
    expect(scripts).toEqual([]);
  });

  test("closed when the page scrolls, the focus back on its button without scrolling back", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const trigger = page.getByRole("button", { name: "Toutes les étiquettes" });
    await trigger.click();
    await expect(allTags(page)).toBeVisible();
    // (After the grace following its opening.)
    await page.waitForTimeout(500);
    await page.locator("#page").evaluate((scroller) => {
      scroller.scrollTo(0, 400);
    });
    await expect(allTags(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.locator("#page").evaluate(scroller => scroller.scrollTop)).toBe(400);
  });

  test("a scroll of the page right after its opening, not the reader's, undone", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const scroller = page.locator("#page");
    await scroller.evaluate((element) => {
      element.scrollTo(0, 60);
    });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    // As Safari did, the list bringing its tag into view before the panel
    // was placed (at the scroller's top).
    await scroller.evaluate((element) => {
      element.scrollTo(0, 0);
    });
    await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(60);
    await expect(allTags(page)).toBeVisible();
  });

  test("kept open by a brush, scrolling with its button", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const trigger = page.getByRole("button", { name: "Toutes les étiquettes" });
    await trigger.click();
    await expect(allTags(page)).toBeVisible();
    // In the pages' scroller: it scrolls with the page, natively (not
    // placed again after the scroll, a frame late).
    await expect(page.locator("#page > [data-reka-popper-content-wrapper]")).toHaveCount(1);
    const gap = async (): Promise<number> => (await allTags(page).boundingBox())!.y - (await trigger.boundingBox())!.y;
    const before = await gap();
    await page.waitForTimeout(500);
    await page.mouse.move(600, 500);
    await page.mouse.wheel(0, 8);
    await page.waitForTimeout(200);
    await expect(allTags(page)).toBeVisible();
    expect(await gap()).toBeCloseTo(before, 0);
  });

  test("every tag, the current one first (active), then in their order, selected if the entry has it", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // In their order (by name): Ciel, Rouge, Vert; the current tag is Ciel.
    await seedBookmarks(page, {
      tags: [
        { name: "Vert", color: "Green", entries: [logos] },
        { name: "Ciel", color: "Sky" },
        { name: "Rouge", color: "Red" },
      ],
      current: "Ciel",
    });

    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const list = allTags(page).getByRole("listbox");
    await expect(list).toHaveAttribute("aria-multiselectable", "true");
    // Few tags: no filter.
    await expect(allTags(page).getByRole("textbox")).toHaveCount(0);
    const options = list.getByRole("option");
    await expect(options).toHaveText(["Cielactive", "Rouge", "Vert"]);
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");

    await options.nth(1).click();
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await options.nth(2).click();
    await expect(options.nth(2)).toHaveAttribute("aria-selected", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
    // The order does not change while the panel is open.
    await expect(options).toHaveText(["Cielactive", "Rouge", "Vert"]);

    // The current tag, from the panel or from its own button (named after it,
    // its state in aria-pressed, its action in a tooltip).
    await options.nth(0).click();
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Ciel", "Rouge"]);
    await page.keyboard.press("Escape");
    await expect(allTags(page)).toBeHidden();
    const current = page.getByRole("button", { name: "Étiquette active : Ciel" });
    await expect(current).toHaveAttribute("aria-pressed", "true");
    await current.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Retirer de « Ciel »");
    await current.click();
    await expect(current).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Rouge"]);
  });

  test("the tags in the bookmarks page's order, in the panel (the active one first) and the active tag's menu", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    // Created in this order: by latest addition (the default), Delta, Gamma,
    // Bêta, Alpha, but Bêta pinned first; Alpha active.
    await seedBookmarks(page, {
      tags: [{ name: "Alpha", color: "Green" }, { name: "Bêta", color: "Rose", pinned: true }, { name: "Gamma", color: "Sky" }, { name: "Delta", color: "Red", entries: [logos] }],
      current: "Alpha",
    });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const options = allTags(page).getByRole("option");
    await expect(options).toHaveText(["Alphaactive", "Bêta", "Delta", "Gamma"]);
    // A pinned tag shows a pin (filled when the entry has it), the others a tag.
    await expect(options.nth(1).locator(".iconify.i-lucide\\:pin")).toBeVisible();
    await expect(options.nth(2).locator(".iconify.i-bailly\\:tag-filled")).toBeVisible();
    await options.nth(1).click();
    await expect(options.nth(1).locator(".iconify.i-bailly\\:pin-filled")).toBeVisible();
    await page.keyboard.press("Escape");

    await goto("/signets", { waitUntil: "hydration" });
    await page.getByRole("group", { name: "Étiquettes" }).getByRole("button", { name: "Étiquette active" }).click();
    const items = page.getByRole("listbox").getByRole("option");
    await expect(items).toHaveText(["Bêta", "Delta", "Gamma", "Alpha"]);
    await expect(items.nth(0).locator(".iconify.i-bailly\\:pin-filled")).toBeVisible();
    await expect(items.nth(1).locator(".iconify.i-bailly\\:tag-filled")).toBeVisible();
  });

  test("a tag toggled with the pointer keeps the highlight, the pointer on it", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, {
      tags: [{ name: "Ciel", color: "Sky" }, { name: "Rouge", color: "Red" }, { name: "Vert", color: "Green" }],
      current: "Ciel",
    });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const options = allTags(page).getByRole("option");
    // The latest created first (the default sorting), after the active one.
    await expect(options).toHaveText(["Cielactive", "Vert", "Rouge"]);

    for (const [i, selected] of [[2, "true"], [2, "false"], [1, "true"], [2, "true"]] as const) {
      await options.nth(i).hover();
      await options.nth(i).click();
      await expect(options.nth(i)).toHaveAttribute("aria-selected", selected);
      // Long enough for the bookmarks to be saved and the panel to update.
      await page.waitForTimeout(300);
      await expect(options.nth(i)).toHaveAttribute("data-highlighted");
      await expect(options.and(page.locator("[data-highlighted]"))).toHaveCount(1);
    }
  });

  test("many tags, its button low on a phone: the panel within the room left, its field in view", async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: Array.from({ length: 20 }, (_, index) => ({ name: `Étiquette ${index}`, color: "Green" })) });
    const trigger = page.getByRole("button", { name: "Toutes les étiquettes" });
    // The toolbar near the screen's bottom (the panel opening upward).
    await page.locator("#page").evaluate((scroller) => {
      scroller.style.paddingTop = "600px";
      scroller.scrollBy(0, document.querySelector("button[aria-label='Toutes les étiquettes']")!.getBoundingClientRect().bottom - 470);
    });
    const scrolled = await page.locator("#page").evaluate(scroller => scroller.scrollTop);
    await trigger.click();
    const filter = allTags(page).getByRole("textbox");
    await expect(filter).toBeFocused();
    await expect(filter).toBeInViewport({ ratio: 1 });
    const [panelTop, scrollerTop] = await Promise.all([allTags(page).boundingBox(), page.locator("#page").boundingBox()]);
    expect(panelTop!.y).toBeGreaterThanOrEqual(scrollerTop!.y);
    // Focused without scrolling the page.
    expect(await page.locator("#page").evaluate(scroller => scroller.scrollTop)).toBe(scrolled);
  });

  test("from eight tags, a field filters them, ignoring case and accents; Enter toggles the option", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const names = ["Éthique", "Médecine", "Poésie", "Rhétorique", "Histoire", "Tragédie", "Comédie", "Épopée"];
    await seedBookmarks(page, { tags: names.map(name => ({ name, color: "Sky" })), current: "Éthique" });

    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    const filter = allTags(page).getByRole("textbox");
    await expect(filter).toHaveAttribute("placeholder", "Filtrer les étiquettes");
    await expect(filter).toBeFocused();
    const options = allTags(page).getByRole("option");
    await expect(options).toHaveCount(8);

    await filter.fill("TRAGEDIE");
    await expect(options).toHaveText(["Tragédie"]);
    await page.keyboard.press("Enter");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => tagNamesOf(page, "logos")).toEqual(["Tragédie"]);

    await filter.fill("epo");
    await expect(options).toHaveText(["Épopée"]);
    await filter.fill("zzz");
    await expect(options).toHaveCount(0);
    await expect(allTags(page)).toContainText("Aucune étiquette ne correspond.");
  });

  test("without tags, a message and the link to manage them", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).click();
    await expect(allTags(page)).toContainText("Aucune étiquette pour l'instant.");
    await allTags(page).getByRole("link", { name: "Gérer les étiquettes" }).click();
    await expect(page).toHaveURL(/\/signets$/);
  });

  test("the favorite: named, its state in aria-pressed, its action in a tooltip", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    const star = page.getByRole("button", { name: "Favori" });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.hover();
    await expect(page.locator("[role=tooltip]")).toContainText("Ajouter aux favoris");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("the tags of an entry on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });

  test("a phone held sideways, its button half-way: two tags at least, the whole panel in view, its field at 16 px (no zoom of iOS)", async ({ page, goto }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: Array.from({ length: 12 }, (_, index) => ({ name: `Étiquette ${index}`, color: "Green" })) });
    await goto("/", { waitUntil: "hydration" });
    const trigger = page.getByRole("button", { name: "Toutes les étiquettes" });
    await expect(trigger).toBeVisible();
    await page.locator("#page").evaluate((scroller) => {
      scroller.scrollBy(0, document.querySelector("button[aria-label='Toutes les étiquettes']")!.getBoundingClientRect().bottom - 300);
    });
    await trigger.tap();
    const filter = allTags(page).getByRole("textbox");
    await expect(filter).toBeVisible();
    // Fitting neither above nor below its button, the panel opens below it,
    // whole, the page scrolled first: not under the header.
    const [panel, scroller] = await Promise.all([allTags(page).boundingBox(), page.locator("#page").boundingBox()]);
    expect(panel!.y).toBeGreaterThanOrEqual(scroller!.y);
    await expect(allTags(page)).toHaveAttribute("data-side", "bottom");
    expect(await filter.evaluate(input => getComputedStyle(input).fontSize)).toBe("16px");
    const options = allTags(page).getByRole("option");
    await expect(options.nth(0)).toBeInViewport({ ratio: 1 });
    await expect(options.nth(1)).toBeInViewport({ ratio: 1 });
  });

  test("opened by a touch: its whole list, its field not focused; touched, the panel kept in place as the keyboard shows", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await seedBookmarks(page, { tags: Array.from({ length: 20 }, (_, index) => ({ name: `Étiquette ${index}`, color: "Green" })) });
    await page.getByRole("button", { name: "Toutes les étiquettes" }).tap();
    await expect(allTags(page)).toBeFocused();
    const filter = allTags(page).getByRole("textbox");
    await expect(filter).not.toBeFocused();

    await filter.tap();
    await expect(filter).toBeFocused();
    const side = await allTags(page).getAttribute("data-side");
    const height = (await allTags(page).boundingBox())!.height;
    // The page brought to the field (iOS Safari), the room left smaller
    // (the keyboard): neither closed, nor turned over, nor crushed.
    await page.locator("#page").evaluate((scroller) => {
      scroller.scrollBy(0, 100);
    });
    await page.setViewportSize({ width: 390, height: 400 });
    await page.waitForTimeout(300);
    await expect(allTags(page)).toBeVisible();
    await expect(allTags(page)).toHaveAttribute("data-side", side!);
    expect((await allTags(page).boundingBox())!.height).toBeCloseTo(height, 0);
  });
});
