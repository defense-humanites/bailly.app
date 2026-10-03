import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { searchBar, xExtent } from "./helpers";

const historyButton = (page: Page) => page.getByRole("button", { name: "Entrées consultées récemment" });
const historyPanel = (page: Page) => page.getByRole("dialog");
const historyLinks = (page: Page) => historyPanel(page).getByRole("listitem").getByRole("link");

/**
 * Opens the history panel and waits for its opening animation.
 */
async function openHistory(page: Page): Promise<void> {
  await historyButton(page).click();
  await historyPanel(page).evaluate(element =>
    Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
}

test.describe("history of the viewed entries", () => {
  test("its button as wide as the options' one (3rem)", async ({ page, goto }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await goto("/", { waitUntil: "hydration" });
    const width = async (name: string) => (await page.getByRole("button", { name }).boundingBox())?.width;
    expect(await width("Entrées consultées récemment")).toBe(48);
    expect(await width("Options de recherche")).toBe(48);
  });

  test("empty at first", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await openHistory(page);
    await expect(historyPanel(page)).toContainText("Aucune entrée consultée pour l'instant.");
  });

  test("newest first, as wide as the bar, leading to the entries", async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await goto("/logos", { waitUntil: "hydration" });
    await goto("/logades", { waitUntil: "hydration" });

    await openHistory(page);
    await expect(historyLinks(page)).toHaveCount(2);
    await expect(historyLinks(page).nth(0)).toContainText("λογάδες");
    await expect(historyLinks(page).nth(1)).toContainText("λόγος");
    const [dialog, bar] = [await xExtent(page, "[role=dialog]"), await xExtent(page, "header .group\\/search")];
    expect(Math.abs(dialog[0] - bar[0])).toBeLessThan(1);
    expect(Math.abs(dialog[1] - bar[1])).toBeLessThan(1);
    await expect(searchBar(page)).toBeVisible();

    // The focus starts on the newest entry, then goes through the entries
    // with the arrow keys.
    await expect(historyLinks(page).nth(0)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(historyLinks(page).nth(1)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(historyLinks(page).nth(0)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(historyLinks(page).nth(1)).toBeFocused();

    // Chosen, the entry closes the panel and moves to the top.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/logos$/);
    await expect(historyPanel(page)).toBeHidden();
    await openHistory(page);
    await expect(historyLinks(page).nth(0)).toContainText("λόγος");
  });

  test("cleared after a confirmation", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await openHistory(page);
    await historyPanel(page).getByRole("button", { name: "Effacer l'historique" }).click();
    await historyPanel(page).getByRole("button", { name: "Annuler" }).click();
    await expect(historyLinks(page)).toHaveCount(1);

    await historyPanel(page).getByRole("button", { name: "Effacer l'historique" }).click();
    await historyPanel(page).getByRole("button", { name: "Effacer", exact: true }).click();
    await expect(historyPanel(page)).toContainText("Aucune entrée consultée pour l'instant.");
  });
});
