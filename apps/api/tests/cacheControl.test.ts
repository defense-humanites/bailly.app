import { assertEquals } from "./support/assert.ts";
import { app } from "#test-app";
import { CACHEABLE } from "../src/app.ts";
import { test } from "./support/test.ts";

/*
 * `Cache-Control` (cf. `CACHEABLE` in `src/app.ts`): the responses that depend only on
 * the request and on the dictionary are kept a day by browsers and by the Worker's
 * cache; nothing else is kept.
 */

const cacheControl = async (path: string, init?: RequestInit, status = 200) => {
  const response = await app.request(path, init);
  await response.body?.cancel();
  assertEquals(response.status, status, path);
  return response.headers.get("Cache-Control");
};

test("Cache-Control: lookups, entries and excerpts are cacheable", async () => {
  assertEquals(await cacheControl("/lookup/λογ"), CACHEABLE);
  assertEquals(await cacheControl("/lookup/logos?inputMode=transliteration&morphology=true"), CACHEABLE);
  assertEquals(await cacheControl("/entry/logos?siblings=true"), CACHEABLE);
  assertEquals(await cacheControl("/entries/excerpts?uris=logos,psuchê"), CACHEABLE);
});

test("Cache-Control: random entries, errors and unknown paths are not kept", async () => {
  assertEquals(await cacheControl("/entry/random"), "no-store");
  assertEquals(await cacheControl("/entries/excerpts", undefined, 400), "no-store");
  assertEquals(await cacheControl("/no/such/path", undefined, 404), "no-store");
  assertEquals(
    await cacheControl("/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "logos,psuchê" })
    }),
    "no-store"
  );
});
