import { expect, test } from "@nuxt/test-utils/playwright";
import { FEATURES } from "../../shared/utils/features";

test.describe("search engines", () => {
  // The home page: the site's title, a description of its own, the site's
  // name for the search engines (structured data).
  test("the home page's head", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    await expect(page).toHaveTitle("Bailly.app — Dictionnaire grec-français en ligne");
    await expect(page.locator("meta[name=description]")).toHaveAttribute("content", /^Le dictionnaire grec-français d'Anatole Bailly/);
    await expect(page.locator("meta[name=description]")).toHaveCount(1);
    const data = JSON.parse((await page.locator("script[type='application/ld+json']").textContent())!) as { "@type": string; "name": string };
    expect(data).toMatchObject({ "@type": "WebSite", "name": "Bailly.app" });
  });

  // Every other page: its own title, bare.
  test("the pages' own titles, bare", async ({ page, goto }) => {
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await expect(page).toHaveTitle("À propos");
  });

  // The canonical address: the site's host, the path without the query.
  test("a canonical address, without the query", async ({ page, goto }) => {
    await goto("/logos?source=test", { waitUntil: "hydration" });
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", "https://bailly.app/logos");
    await goto(encodeURI("/à-propos"), { waitUntil: "hydration" });
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", `https://bailly.app${encodeURI("/à-propos")}`);
  });

  // The entry drawn at random on the home page: its links `nofollow`.
  test("the random entry's links are nofollow", async ({ page, goto }) => {
    await goto("/", { waitUntil: "hydration" });
    const opening = page.getByRole("region", { name: "Le Bailly ouvert au hasard" });
    await expect(opening.locator("a").first()).toBeVisible();
    const rels = await opening.locator("a").evaluateAll(links => links.map(link => link.getAttribute("rel")));
    expect(rels.length).toBeGreaterThan(0);
    expect(rels.every(rel => rel === "nofollow")).toBe(true);
  });

  // The site map: the fixed pages (the news while offered), and its address
  // in robots.txt.
  test("a site map, named in robots.txt", async ({ request }) => {
    const map = await request.get("/sitemap.xml");
    expect(map.headers()["content-type"]).toContain("application/xml");
    const locations = [...(await map.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => decodeURI(url!));
    expect(locations).toEqual([
      "https://bailly.app/",
      "https://bailly.app/à-propos",
      ...(FEATURES.news ? ["https://bailly.app/nouveautés"] : []),
      "https://bailly.app/signets",
      "https://bailly.app/préférences",
      "https://bailly.app/confidentialité",
    ]);
    expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://bailly.app/sitemap.xml");
  });
});
