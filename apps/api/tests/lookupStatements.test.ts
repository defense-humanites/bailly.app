import { assertEquals } from "@std/assert";
import { Database } from "../src/Database.ts";
import { app } from "../src/index.ts";
import { Settings } from "../src/Settings.ts";

/*
 * The lookup statements are all prepared at startup (`preloadLookupStatements()`,
 * called by `src/index.ts`): 4 search columns × 2 operators × (1 count statement +
 * 2^n sets of fields, `word` excluded). The field order is canonical, so that no
 * request compiles a new statement, whatever the order of `fields`.
 */

const optionalFields = Settings.getSettings().queryAllowedFields
  .filter((field) => field !== "word");

Deno.test("preloadLookupStatements: every variant is prepared at startup", () => {
  assertEquals(
    Database.preparedStatementCount,
    4 * 2 * (1 + 2 ** optionalFields.length)
  );
});

Deno.test("GET /lookup: no statement compiled at request time", async () => {
  const before = Database.preparedStatementCount;

  const requests = [
    "/lookup/λογος?fields=uri,word",
    "/lookup/λογος?fields=word,uri",
    "/lookup/λογος?fields=excerpt,uri",
    "/lookup/λογος?fields=uri,excerpt&caseSensitive=true",
    "/lookup/λογος?fields=uri&diacriticSensitive=true",
    "/lookup/%22λογος%22?fields=uri",
    "/lookup/α?fields=uri&limit=5",
    "/lookup/λογ%3Fς?fields=uri"
  ];

  for (const request of requests) {
    const response = await app.request(`${request}&skipMorpheus=true`);
    assertEquals(response.status, 200, request);
    await response.body?.cancel();
  }

  assertEquals(Database.preparedStatementCount, before);
});
