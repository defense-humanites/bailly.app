import { expect, test } from "@nuxt/test-utils/playwright";
import type { Locator, Page } from "@playwright/test";
import { searchInput, searchResults, seedBookmarks } from "./helpers";

// Real entries (from the recorded API responses).
const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole : I la parole, en gén. : ἔργα λόγου μέζω, Hdt. 2, 35, actions au-dessus de ce qu’on en pourrait dire ; λόγου κρεῖσσον, Thc. 2,…" };
const logotechnes = { word: "λογοτέχνης", uri: "logotechnês", excerpt: "λογο·τέχνης, ου (ὁ) habile artisan de paroles, Rhét. (W. 2, 90). Étym. λ. τέχνη. " };
const logades = {
  word: "λογάδες",
  uri: "logades",
  excerpt: "",
  children: [
    { word: "λογάδες", uri: "logades#1", excerpt: "λογάδες, ων (αἱ) 1 blanc de l’œil, Nic. Th. 292 || 2 d’où œil, Anth. 5, 270. " },
    { word: "λογάδες", uri: "logades#2", excerpt: "λογάδες, v. λογάς." },
  ],
};

/**
 * Tags created in this order, thus in the user's order: Rouge, Ciel, Vert.
 * The current tag is Ciel.
 */
async function seed(page: Page): Promise<void> {
  await seedBookmarks(page, {
    tags: [
      { name: "Vert", color: "Green", entries: [logos, logades, logotechnes] },
      { name: "Ciel", color: "Sky", entries: [logos] },
      { name: "Rouge", color: "Red", entries: [logos, logades] },
    ],
    current: "Ciel",
  });
}

/**
 * The tag shown for an entry (its color) and the number of the others.
 */
async function indicator(container: Locator): Promise<{ color: string | null; others: string | null }> {
  const icon = container.locator("[data-tag-color]");
  await expect(icon).toBeVisible();
  const chip = container.locator("[data-slot=base]");
  return {
    color: await icon.getAttribute("data-tag-color"),
    others: await chip.count() ? await chip.textContent() : null,
  };
}

test.describe("tags of the entries, in the history and the results", () => {
  test("the current tag first, then the first one in the user's order, and a count of the others", async ({ page, goto }) => {
    await goto("/logotechnês", { waitUntil: "hydration" });
    await goto("/logades", { waitUntil: "hydration" });
    await goto("/logos", { waitUntil: "hydration" });
    await seed(page);

    await page.getByRole("button", { name: "Entrées consultées récemment" }).click();
    const links = page.getByRole("dialog").getByRole("listitem");
    await expect(links).toHaveCount(3);
    // λόγος: in the current tag (Ciel), and two others.
    expect(await indicator(links.nth(0))).toEqual({ color: "Sky", others: "+2" });
    // λογάδες: not in the current tag; Rouge comes before Vert.
    expect(await indicator(links.nth(1))).toEqual({ color: "Red", others: "+1" });
    // λογοτέχνης: a single tag.
    expect(await indicator(links.nth(2))).toEqual({ color: "Green", others: null });
    await expect(links.nth(0)).toContainText("(étiquettes : Rouge, Ciel, Vert)");
  });

  test("in the results", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await seed(page);
    await searchInput(page).fill("logos");
    const option = searchResults(page).getByRole("option", { name: /^λόγος, ου/ });
    expect(await indicator(option)).toEqual({ color: "Sky", others: "+2" });
  });
});
