import { expect, test } from "@nuxt/test-utils/playwright";
import type { Page } from "@playwright/test";
import { FEATURES } from "../../shared/utils/features";

const SDK_URL = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";

/**
 * Replaces PayPal's Donate SDK (no network in the tests) with a stub that
 * renders the button image and, on click, reports a donation of 10 €.
 */
async function stubSdk(page: Page): Promise<string[]> {
  const options: string[] = [];
  await page.exposeFunction("reportDonateOptions", (json: string) => options.push(json));
  await page.route(SDK_URL, route => route.fulfill({
    contentType: "text/javascript",
    body: `window.PayPal = { Donation: { Button: (options) => ({ render: (selector) => {
      window.reportDonateOptions(JSON.stringify({ env: options.env, id: options.hosted_button_id, image: options.image }));
      const image = document.createElement("img");
      image.src = options.image.src;
      image.alt = options.image.alt;
      image.addEventListener("click", () => options.onComplete({ tx: "T", st: "Completed", amt: "10.00", cc: "EUR" }));
      document.querySelector(selector).append(image);
    } }) } };`,
  }));
  return options;
}

test.describe("donations", () => {
  test.skip(!FEATURES.donations, "The donations are not offered yet (cf. `FEATURES`).");

  test("the home page leads to the donation page", async ({ page, goto }) => {
    await page.route(SDK_URL, route => route.abort());
    await goto("/", { waitUntil: "hydration" });
    await page.getByRole("link", { name: /Nous soutenir/ }).click();
    await expect(page).toHaveURL(/\/soutenir$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nous soutenir");
  });

  test("PayPal's button, then the thanks on the page", async ({ page, goto }) => {
    const options = await stubSdk(page);
    await goto("/soutenir", { waitUntil: "hydration" });
    const button = page.getByRole("img", { name: "Faire un don avec PayPal" });
    await expect(button).toBeVisible();
    expect(JSON.parse(options[0]!)).toMatchObject({ env: "production", id: "HFBZZVKRBE7HY" });

    await button.click();
    // Announced (a polite live region around the button).
    await expect(page.locator("main [aria-live=polite]")).toContainText("Merci pour votre don de 10,00 € !");
    await expect(page.getByRole("link", { name: "Reprendre la lecture" })).toBeVisible();
  });

  test("a link to PayPal's page if its script can't load", async ({ page, goto }) => {
    await page.route(SDK_URL, route => route.abort());
    await goto("/soutenir", { waitUntil: "hydration" });
    await expect(page.getByRole("link", { name: "Faire un don sur le site de PayPal" }))
      .toHaveAttribute("href", /^https:\/\/www\.paypal\.com\/donate\/\?hosted_button_id=HFBZZVKRBE7HY/);
  });

  test("PayPal's return pages: thanks, cancellation; back to the reading", async ({ page, goto }) => {
    await goto("/logos", { waitUntil: "hydration" });
    await goto("/soutenir/merci", { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merci pour votre don !");
    await expect(page.getByRole("link", { name: "Reprendre la lecture" })).toHaveAttribute("href", "/logos");

    await goto("/soutenir/annule", { waitUntil: "hydration" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Don annulé");
    await expect(page.getByRole("link", { name: "Réessayer" })).toHaveAttribute("href", "/soutenir");
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex");
  });
});
