import { expect, test } from "@nuxt/test-utils/playwright";
import type { BrowserContext } from "@playwright/test";
import { searchInput } from "./helpers";

const COOKIE = "bailly-preferences";

/**
 * The application's keys in the local storage (not the dev tools' ones).
 */
const storage = (page: import("@playwright/test").Page) => page.evaluate(() =>
  Object.fromEntries(Object.entries(localStorage).filter(([key]) => !key.startsWith("__VUE_DEVTOOLS"))));

const preferencesCookie = async (context: BrowserContext) =>
  (await context.cookies()).find(cookie => cookie.name === COOKIE);

test.describe("preferences", () => {
  test("a first visit stores nothing (but the color mode, in a cookie)", async ({ page, goto, context }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await searchInput(page).fill("log");
    expect(await preferencesCookie(context)).toBeUndefined();
    expect(Object.keys(await storage(page))).toEqual([]);
  });

  test("stored in a cookie, which the server renders the pages with", async ({ page, goto, context }) => {
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Options de recherche" }).click();
    await page.getByText("Translittération", { exact: true }).click();
    const cookie = await preferencesCookie(context);
    expect(JSON.parse(decodeURIComponent(cookie!.value))).toEqual({ inputMode: "transliteration" });
    expect(cookie!.sameSite).toBe("Lax");

    // The server's HTML already has the transliteration placeholder.
    // (Fetched by the browser: the cookie is secure outside development.)
    const html = await page.evaluate(async () => (await fetch("/")).text());
    expect(html).toContain("placeholder=\"anazētéō…\"");
  });

  test("the previous application's storage is migrated once", async ({ page, goto, context }) => {
    await goto("/", { waitUntil: "hydration" });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("searchInputMode", "transliteration");
      localStorage.setItem("searchSkipLemmatization", "true");
      localStorage.setItem("theme", "dark");
      localStorage.setItem("currentTagKey", "3");
      localStorage.setItem("dismissSearchBarMorphologicalResultsWarning", "true");
      localStorage.setItem("historyLength", "20");
    });
    await goto("/", { waitUntil: "hydration" });

    await expect(searchInput(page)).toHaveAttribute("placeholder", "anazētéō…");
    const cookie = await preferencesCookie(context);
    // (The theme too, a preference now, cf. `useThemePreference`.)
    expect(JSON.parse(decodeURIComponent(cookie!.value))).toEqual({ inputMode: "transliteration", inflectedForms: false, theme: "dark" });
    // (The current tag key is migrated too, then removed by the store once
    // it has loaded the bookmarks, as there is no tag 3 here: not checked.)
    const stored = await storage(page);
    expect(stored).toMatchObject({
      "bailly:dismissed": "[\"morpheusWarning\"]",
    });
    expect((await context.cookies()).find(cookie => cookie.name === "bailly-theme")?.value).toBe("dark");
    expect(Object.keys(stored).filter(key => !key.startsWith("bailly:"))).toEqual([]);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("the table of the input modes, from « Saisie »", async ({ page, goto }) => {
    await goto(encodeURI("/préférences"), { waitUntil: "hydration" });
    await page.getByRole("button", { name: "Table de correspondance" }).click();
    const dialog = page.getByRole("dialog", { name: "Table de correspondance" });
    await expect(dialog.getByRole("row", { name: /^êta/ })).toContainText("ē, ê");
    await expect(dialog.getByRole("row", { name: /^xi/ })).toContainText("c");
    await expect(dialog.getByRole("row", { name: /^Esprit rude/ })).toContainText("(");
    // A capital: the asterisk, then the diacritics, then the letter.
    await expect(dialog).toContainText("*)/a → Ἄ");
  });
});
