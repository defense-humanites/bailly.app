import { assertEquals } from "./support/assert.ts";
import { app, dictionary } from "#test-app";
import { Settings } from "../src/Settings.ts";
import { test } from "./support/test.ts";

/*
 * The lookup statements are all prepared at startup (`preloadLookupStatements()`,
 * called by `createNodeDependencies()`): 4 search columns × 2 operators × (1 count
 * statement + 2 lookup statements — priority rows, other rows — × 2^n sets of
 * fields, `word` excluded). The field order is canonical, so that no request
 * compiles a new statement, whatever the order of `fields`.
 *
 * SQLite only: D1 compiles its statements itself (`preparedStatementCount` stays at
 * 0), and these tests are skipped there.
 */

const optionalFields = Settings.getSettings().queryAllowedFields
  .filter((field) => field !== "word");

const sqlite = dictionary.preparedStatementCount > 0;

test({
  name: "preloadLookupStatements: every variant is prepared at startup",
  ignore: !sqlite,
  fn: () => {
    assertEquals(
      dictionary.preparedStatementCount,
      4 * 2 * (1 + 2 * 2 ** optionalFields.length)
    );
  }
});

test({
  name: "GET /lookup: no statement compiled at request time",
  ignore: !sqlite,
  fn: async () => {
    const before = dictionary.preparedStatementCount;

    const requests = [
      "/lookup/λογος?fields=uri,word",
      "/lookup/λογος?fields=word,uri",
      "/lookup/λογος?fields=excerpt,uri",
      "/lookup/λογος?fields=uri,excerpt&caseSensitive=true",
      "/lookup/λογος?fields=uri&diacriticSensitive=true",
      "/lookup/%22λογος%22?fields=uri",
      "/lookup/α?fields=uri&limit=5",
      "/lookup/λογος%24?fields=uri&limit=5",
      "/lookup/*λογος?fields=uri,excerpt&limit=5",
      "/lookup/λογ%3Fς?fields=uri"
    ];

    for (const request of requests) {
      const response = await app.request(`${request}&skipMorpheus=true`);
      assertEquals(response.status, 200, request);
      await response.body?.cancel();
    }

    assertEquals(dictionary.preparedStatementCount, before);
  }
});
