import { expect, test } from "@nuxt/test-utils/playwright";

const definition = "main .definition";

const formUrl = `/forme/${encodeURIComponent("αἱ")}`;

test.describe("links of the definitions", () => {
  test("discreet, and an ambiguous form leads to its page", async ({ page, goto }) => {
    await goto("/logades", { waitUntil: "hydration" });
    const ambiguous = page.locator(`${definition} a[data-linked-entries]`).first();
    await expect(ambiguous).toHaveText("αἱ");
    await expect(ambiguous).toHaveAttribute("href", formUrl);
    await expect(ambiguous).toHaveCSS("text-decoration-style", "solid");
    await expect(ambiguous).toHaveCSS("text-decoration-thickness", "1px");
    // The forms of the current entry aren't links.
    await expect(page.locator(`${definition} a[data-linked-self]`)).toHaveCount(0);

    // Followed within the application (no reload).
    await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
    await ambiguous.click();
    await expect(page).toHaveURL(new RegExp(`${formUrl}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("αἱ");
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  });
});

test.describe("page of an ambiguous form", () => {
  test("its entries as cards, each a link to the entry; the headwords on the right on a wide screen", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await goto(formUrl, { waitUntil: "hydration" });
    await expect(page.locator("main header").first()).toContainText("Graphie ambiguë · 2 entrées");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["αἱ", "ὁ"]);
    const card = page.getByRole("link", { name: "Ouvrir l'entrée ὁ" });
    await expect(card).toHaveAttribute("href", "/ho_(1)");
    // No link inside a card (links can't be nested).
    await expect(card.locator("a")).toHaveCount(0);
    // A long entry is cut and faded; the cards stay under the search bar,
    // the title on their right.
    await expect(card.locator("[data-clip]")).toHaveClass(/mask-b-from/);
    const [cardBox, titleBox] = [await card.boundingBox(), await page.getByRole("heading", { level: 1 }).boundingBox()];
    expect(titleBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width);

    // Links to the cards, the one in view marked; followed, its card is
    // pointed out (even when all the cards are in view), and marked.
    const nav = page.getByRole("navigation", { name: "Accès rapide aux entrées" });
    const headwords = nav.getByRole("link");
    await expect(headwords).toHaveText(["αἱ", "ὁ"]);
    await expect(headwords.nth(0)).toHaveAttribute("aria-current", "location");
    await headwords.nth(1).click();
    await expect(page.locator("#entree-2")).toHaveAttribute("data-card-highlight", "");
    await expect(headwords.nth(1)).toHaveAttribute("aria-current", "location");

    await card.click();
    await expect(page).toHaveURL(/\/ho_\(1\)$/);
  });

  test("below xl: the title above, the headwords in a table of contents sticking under the header", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1024, height: 450 });
    await goto(formUrl, { waitUntil: "hydration" });
    const bar = page.getByRole("navigation", { name: "Accès rapide aux entrées" });
    const chips = bar.getByRole("link");
    await expect(chips).toHaveText(["αἱ", "ὁ"]);
    await expect(chips.nth(0)).toHaveAttribute("aria-current", "location");

    await chips.nth(1).click();
    await expect(page).toHaveURL(/#entree-2$/);
    await expect(page.locator("#entree-2")).toHaveAttribute("data-card-highlight", "");
    await expect(chips.nth(1)).toHaveAttribute("aria-current", "location");
    // The table of contents sticks under the header (once the smooth scroll
    // is over).
    await expect.poll(() => page.evaluate(() => Math.abs(
      document.querySelector("nav[aria-label='Accès rapide aux entrées'].sticky")!.getBoundingClientRect().top
      - document.querySelector("body > div header")!.getBoundingClientRect().bottom,
    ))).toBeLessThan(1);
  });

  test("only the beginning of each definition, the page light", async ({ page, goto }) => {
    // ὁ's definition alone weighs 113 kB of HTML.
    const response = await page.request.get(formUrl);
    expect((await response.body()).length).toBeLessThan(100_000);
    await goto(formUrl, { waitUntil: "hydration" });
    const card = page.getByRole("link", { name: "Ouvrir l'entrée ὁ" });
    await expect(card.locator("[data-clip]")).toHaveClass(/mask-b-from/);
    await expect(card).toContainText("pronom démonstratif");
  });

  test("the entries come from the dictionary, never from the address", async ({ page, goto }) => {
    // The former `?q=` is ignored: it let anyone list any entry under a form.
    await goto(`${formUrl}?q=hai_(1),ho_(1),logos`, { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["αἱ", "ὁ"]);
  });

  test("an unknown form, or none: not found (its text isn't shown)", async ({ page }) => {
    const unknown = await page.goto(`/forme/${encodeURIComponent("Le professeur est nul")}`);
    expect(unknown?.status()).toBe(404);
    await expect(page.getByText("Le professeur est nul")).toHaveCount(0);
    expect((await page.goto("/forme?q=hai_(1),ho_(1)"))?.status()).toBe(404);
  });

  test("the former address (/lecteur) redirects to the form's page; without a form, not found", async ({ page, goto }) => {
    await goto(`/lecteur?q=hai_(1),ho_(1),logos&forme=${encodeURIComponent("αἱ")}`, { waitUntil: "hydration" });
    await expect(page).toHaveURL(new RegExp(`${formUrl}$`));
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["αἱ", "ὁ"]);
    expect((await page.goto("/lecteur?q=hai_(1),ho_(1)"))?.status()).toBe(404);
  });

  test("a single entry: its page", async ({ page, goto }) => {
    await goto(`/forme/${encodeURIComponent("λογοτέχνης")}`, { waitUntil: "hydration" });
    await expect(page).toHaveURL(/\/logotechn%C3%AAs$|\/logotechnês$/);
  });
});
