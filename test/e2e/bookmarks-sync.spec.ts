import { expect, test } from "@nuxt/test-utils/playwright";
import type { Browser, Page } from "@playwright/test";
import { bookmarksState, seedBookmarks, type AppRoot } from "./helpers";

const logos = { word: "λόγος", uri: "logos", excerpt: "λόγος, ου (ὁ) A parole" };
const psuche = { word: "ψυχή", uri: "psuchê", excerpt: "ψυχή, ῆς (ἡ) souffle, âme" };

const waitForHydration = (page: Page) =>
  page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false);

/**
 * Another device: a new browser context (its own storage), on the bookmarks
 * page.
 */
async function newDevice(browser: Browser, baseURL: string | undefined, path = "/signets"): Promise<Page> {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(new URL(path, baseURL).href);
  await waitForHydration(page);
  return page;
}

const openSync = async (page: Page) => {
  await page.getByRole("button", { name: /^Synchronisation/ }).click();
};

const syncLink = (page: Page) => page.evaluate(() => {
  const root = document.querySelector("#__nuxt") as AppRoot;
  const store = root.__vue_app__.config.globalProperties.$pinia._s.get("sync") as unknown as { link: (origin: string) => string | null };
  return store.link(window.location.origin);
});

test("synchronizing the bookmarks of three devices, then deleting them online", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(60_000);

  // Laptop: enables the synchronization, and reads its key.
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue", entries: [logos] }] });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  // The key is kept first; the words and the QR code are in the other tab.
  await expect(page.getByRole("button", { name: "Télécharger le kit de récupération" })).toBeVisible();
  await page.getByRole("tab", { name: "Ajouter un appareil" }).click();
  await page.getByRole("button", { name: "Afficher la clé" }).click();
  const keyWords = page.getByRole("list", { name: "Les douze mots de la clé" }).locator("li > span:last-child");
  await expect(keyWords).toHaveCount(12);
  const words = await keyWords.allInnerTexts();
  await expect(page.getByRole("img", { name: "QR code de la clé" }).locator("svg")).toBeVisible();

  // A click on the words copies them.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("list", { name: "Les douze mots de la clé" }).click();
  await expect(page.getByText("Clé copiée", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(words.join(" "));
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await page.keyboard.press("Escape");

  // Phone: has a favorite of its own, and joins with the 12 words (typed
  // without accents, in capitals).
  const phone = await newDevice(browser, baseURL);
  await seedBookmarks(phone, { starred: [psuche] });
  await openSync(phone);
  await phone.getByRole("button", { name: "J'ai déjà une clé" }).click();
  await phone.getByRole("textbox").fill(words.map(word => word.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()).join(" "));
  await phone.getByRole("button", { name: "Rejoindre" }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect(await bookmarksState(phone)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });
  // The excerpts are not synchronized: the phone fetches the one it lacks from the API.
  await expect(phone.getByText(/ἔργα λόγου μέζω/).first()).toBeVisible();

  // The laptop gets the phone's favorite (e.g. at the next visit).
  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => bookmarksState(page)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });

  // A tablet opens the link of the QR code.
  const link = await syncLink(page);
  expect(link).toMatch(/\/signets#sync=[\w-]{22}$/);
  const tablet = await newDevice(browser, baseURL, new URL(link!).pathname + new URL(link!).hash);
  await expect(tablet.getByText("Activer la synchronisation sur cet appareil avec la clé de ce lien ?")).toBeVisible();
  expect(new URL(tablet.url()).hash).toBe(""); // The key leaves the address.
  await tablet.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(tablet.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect(await bookmarksState(tablet)).toEqual({ tags: ["Homère"], tagged: 1, starred: 2 });

  // The same link, opened again (in the same tab): nothing to replace.
  await tablet.keyboard.press("Escape");
  await tablet.goto(link!);
  await expect(tablet.getByText("Cet appareil est déjà synchronisé avec la clé de ce lien.")).toBeVisible();
  await expect(tablet.getByRole("button", { name: "Remplacer la clé" })).toHaveCount(0);
  await tablet.getByRole("button", { name: "Voir la synchronisation" }).click();
  await expect(tablet.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();

  // A change on the tablet reaches the laptop.
  await tablet.keyboard.press("Escape");
  await seedBookmarks(tablet, { tags: [{ name: "Platon", color: "Rose" }] });
  await expect.poll(async () => {
    await page.reload();
    await waitForHydration(page);
    return (await bookmarksState(page)).tags;
  }, { timeout: 15_000 }).toEqual(["Platon", "Homère"]);

  // The laptop deletes the bookmarks online: the phone stops synchronizing,
  // and keeps its bookmarks.
  await openSync(page);
  await page.getByRole("button", { name: "Arrêter la synchronisation…" }).click();
  await page.getByRole("radio", { name: /^Sur tous vos appareils/ }).click();
  await page.getByRole("button", { name: "Continuer…" }).click();
  await expect(page.getByText("sans retour possible")).toBeVisible();
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Signets supprimés du serveur", { exact: true })).toBeVisible();

  await phone.reload();
  await waitForHydration(phone);
  await openSync(phone);
  await expect(phone.getByText("La synchronisation a été désactivée depuis un autre appareil.")).toBeVisible();
  expect((await bookmarksState(phone)).starred).toBe(2);
});

test("a wrong key is explained", async ({ goto, page }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "J'ai déjà une clé" }).click();

  await page.getByRole("textbox").fill("abaisser zzzz ");
  await expect(page.getByText("« zzzz » n'est pas un mot de la liste.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejoindre" })).toBeDisabled();

  // Twelve valid words that no device synchronizes.
  await page.getByRole("textbox").fill(Array(12).fill("abaisser").join(" "));
  await page.getByRole("button", { name: "Rejoindre" }).click();
  await expect(page.getByText(/ne forment pas une clé valide|Cette clé n'est utilisée par aucun appareil/)).toBeVisible();
});

test("a failed first synchronization is reported, and leaves the device as it was", async ({ page, goto, browser, baseURL }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await expect(page.getByRole("button", { name: "Télécharger le kit de récupération" })).toBeVisible();
  const link = await syncLink(page);

  // The phone reaches the server once (the key exists), then loses it.
  const phone = await newDevice(browser, baseURL, "/");
  let requests = 0;
  await phone.route("**/api/sync/**", route => (++requests === 1 ? route.continue() : route.abort()));
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Le serveur de synchronisation est injoignable.")).toBeVisible();

  await phone.keyboard.press("Escape");
  await openSync(phone);
  await expect(phone.getByRole("button", { name: "Activer la synchronisation" })).toBeVisible();
});

test("a key whose online bookmarks the server emptied: joining explains it", async ({ page, goto, browser, baseURL }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await expect(page.getByRole("button", { name: "Télécharger le kit de récupération" })).toBeVisible();
  const link = await syncLink(page);

  // The locker is found emptied (as after 18 months without access), and
  // the phone fills it again.
  const phone = await newDevice(browser, baseURL, "/");
  let reads = 0;
  let writes = 0;
  await phone.route("**/api/sync/**", (route) => {
    if (route.request().method() === "GET" && ++reads <= 2) return route.fulfill({ status: 204 });
    if (route.request().method() === "PUT" && ++writes === 1) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: 2 }) });
    }
    return route.continue();
  });
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await expect(phone.getByText(/Faute d'activité, le serveur avait effacé vos signets en ligne/).first()).toBeVisible();
});

test("too many synchronizations enabled from this network today: explained", async ({ page, goto }) => {
  await goto("/signets", { waitUntil: "hydration" });
  await page.route("**/api/sync/**", route => (route.request().method() === "PUT"
    ? route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ statusCode: 429, data: { reason: "daily-budget" } }) })
    : route.continue()));
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await expect(page.getByText(/Trop de signets ont été envoyés depuis ce réseau aujourd'hui/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Activer la synchronisation" })).toBeVisible();
});

test("a device keeps the key once the online bookmarks are merged, even if sending its own fails", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(60_000);

  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos] });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  const link = await syncLink(page);

  // The phone reads the online bookmarks, but cannot send its own.
  const phone = await newDevice(browser, baseURL, "/");
  await seedBookmarks(phone, { starred: [psuche] });
  const failPut = (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
    route.request().method() === "PUT" ? route.abort() : route.continue();
  await phone.route("**/api/sync/**", failPut);
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText(/^Vos signets en ligne ont été ajoutés à cet appareil/)).toBeVisible();
  expect(await bookmarksState(phone)).toEqual({ tags: [], tagged: 0, starred: 2 });

  // The key is kept, and the sending retried: the laptop gets the phone's
  // favorite.
  await phone.unroute("**/api/sync/**", failPut);
  await expect(phone.getByText(/^Vos signets en ligne ont été ajoutés à cet appareil/)).toHaveCount(0, { timeout: 25_000 });
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => bookmarksState(page)).toEqual({ tags: [], tagged: 0, starred: 2 });
});

test("joining beyond the limits is refused until the device makes room", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(90_000);
  const hundred = Array.from({ length: 100 }, (_, i) => ({ word: `mot${i}`, uri: `mot-${i}`, excerpt: `mot${i}, extrait` }));

  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: hundred });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  const link = await syncLink(page);

  // The phone has a favorite of its own: 101 once brought together.
  const phone = await newDevice(browser, baseURL, "/");
  await seedBookmarks(phone, { starred: [psuche] });
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText(/les favoris compteraient 101 entrées \(100 au plus\) : retirez-en au moins 1 parmi celles qui ne sont que sur cet appareil \(« ψυχή »\)\. Réessayez ensuite\./)).toBeVisible();
  expect(await bookmarksState(phone)).toEqual({ tags: [], tagged: 0, starred: 1 });

  // Nothing changed online either; once the phone makes room, it joins.
  await phone.keyboard.press("Escape");
  await phone.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { unstarEntry: (uri: string) => Promise<unknown> };
    await store.unstarEntry("psuchê");
  });
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect((await bookmarksState(phone)).starred).toBe(100);
});

test("a synchronization beyond the limits waits until the device makes room", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(90_000);
  const many = Array.from({ length: 99 }, (_, i) => ({ word: `mot${i}`, uri: `mot-${i}`, excerpt: `mot${i}, extrait` }));
  const star = (target: Page, entry: typeof logos) => target.evaluate(async (entry) => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { starEntry: (entry: unknown) => Promise<unknown> };
    await store.starEntry(entry);
  }, entry);
  const syncNow = (target: Page) => target.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("sync") as unknown as { sync: () => Promise<boolean> };
    return store.sync();
  });

  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: many });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  const link = await syncLink(page);
  await page.keyboard.press("Escape");

  const phone = await newDevice(browser, baseURL, "/signets");
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await phone.keyboard.press("Escape");

  // Each device adds its 100th favorite, the phone offline.
  await phone.route("**/api/sync/**", route => route.abort());
  await star(phone, logos);
  await star(page, psuche);
  expect(await syncNow(page)).toBe(true);

  // Back online, the phone does not merge (101 favorites), and says why.
  await phone.unroute("**/api/sync/**");
  expect(await syncNow(phone)).toBe(false);
  await expect(phone.getByRole("button", { name: /demande votre attention/ })).toBeVisible();
  await openSync(phone);
  await expect(phone.getByText(/les favoris compteraient 101 entrées \(100 au plus\) : retirez-en au moins 1 parmi celles qui ne sont que sur cet appareil \(« λόγος »\)\. La synchronisation reprendra ensuite\.$/)).toBeVisible();
  expect((await bookmarksState(phone)).starred).toBe(100);
  await phone.keyboard.press("Escape");

  // Once it makes room, the synchronization resumes by itself.
  await phone.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { unstarEntry: (uri: string) => Promise<unknown> };
    await store.unstarEntry("logos");
  });
  await expect(phone.getByRole("button", { name: /demande votre attention/ })).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(async () => (await bookmarksState(phone)).starred).toBe(100);
  await page.reload();
  await waitForHydration(page);
  await expect.poll(async () => (await bookmarksState(page)).starred).toBe(100); // Unchanged: the phone's favorite was left out.
});

test("the synchronization waits while the tags are being arranged", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(60_000);
  const syncNow = (target: Page) => target.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("sync") as unknown as { sync: () => Promise<boolean> };
    return store.sync();
  });

  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos], tags: [{ name: "Homère", color: "Blue" }, { name: "Platon", color: "Green" }] });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  const link = await syncLink(page);
  await page.keyboard.press("Escape");

  const phone = await newDevice(browser, baseURL, "/");
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  await phone.keyboard.press("Escape");

  // The laptop arranges its tags while the phone adds a favorite.
  await page.getByRole("button", { name: "Arranger" }).click();
  await expect(page.getByRole("dialog", { name: "Arranger les étiquettes" })).toBeVisible();
  await seedBookmarks(phone, { starred: [psuche] });
  // (Once its settings are loaded, after the reload.)
  await expect.poll(() => syncNow(phone)).toBe(true);

  await syncNow(page); // Deferred: nothing changes under the user's feet.
  expect((await bookmarksState(page)).starred).toBe(1);

  // Once the window is closed, the laptop synchronizes, and the phone's
  // favorite shows (without reloading).
  await page.keyboard.press("Escape");
  await expect(page.getByText(/ψυχή, ῆς/).first()).toBeVisible({ timeout: 15_000 });
  expect((await bookmarksState(page)).starred).toBe(2);
});

test("a wrong clock on the device is reported", async ({ page, goto }) => {
  const day = 24 * 60 * 60 * 1000;
  // The server's time, three days after this device's.
  await page.route("**/api/sync/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), date: new Date(Date.now() + 3 * day).toUTCString() } });
  });

  await goto("/signets", { waitUntil: "hydration" });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  await page.getByRole("button", { name: "J'ai conservé ma clé" }).click();
  await expect(page.getByText("L'horloge de cet appareil semble en retard de 3 jours.")).toBeVisible();
});

test("enabling a key again brings back the online bookmarks deleted meanwhile", async ({ page, goto, browser, baseURL }) => {
  test.setTimeout(60_000);
  await goto("/signets", { waitUntil: "hydration" });
  await seedBookmarks(page, { starred: [logos, psuche] });
  await openSync(page);
  await page.getByRole("button", { name: "Activer la synchronisation" }).click();
  // The key is kept first; the words and the QR code are in the other tab.
  await expect(page.getByRole("button", { name: "Télécharger le kit de récupération" })).toBeVisible();
  await page.getByRole("tab", { name: "Ajouter un appareil" }).click();
  await page.getByRole("button", { name: "Afficher la clé" }).click();
  const keyWords = page.getByRole("list", { name: "Les douze mots de la clé" }).locator("li > span:last-child");
  await expect(keyWords).toHaveCount(12);
  const words = await keyWords.allInnerTexts();
  const link = await syncLink(page);

  const phone = await newDevice(browser, baseURL, "/");
  await phone.goto(link!);
  await phone.getByRole("button", { name: "Activer", exact: true }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();

  // The phone disables the synchronization, then deletes a favorite.
  await phone.getByRole("button", { name: "Arrêter la synchronisation…" }).click();
  await expect(phone.getByText("même ceux que vous y auriez supprimés entre-temps")).toBeVisible();
  await phone.getByRole("button", { name: "Désactiver sur cet appareil" }).click();
  await expect(phone.getByText("Synchronisation désactivée sur cet appareil", { exact: true })).toBeVisible();
  await phone.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as AppRoot;
    const store = root.__vue_app__.config.globalProperties.$pinia._s.get("bookmarks") as unknown as { unstarEntry: (uri: string) => Promise<unknown> };
    await store.unstarEntry("logos");
  });
  expect((await bookmarksState(phone)).starred).toBe(1);

  // Enabled again with the words: the favorite comes back, and stays on the laptop.
  await phone.getByRole("button", { name: "J'ai déjà une clé" }).click();
  await phone.getByRole("textbox").fill(words.join(" "));
  await phone.getByRole("button", { name: "Rejoindre" }).click();
  await expect(phone.getByText("Synchronisation activée sur cet appareil.")).toBeVisible();
  expect((await bookmarksState(phone)).starred).toBe(2);

  await page.reload();
  await waitForHydration(page);
  await expect.poll(async () => (await bookmarksState(page)).starred).toBe(2);
});
