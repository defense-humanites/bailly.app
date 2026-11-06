import { assertEquals } from "./support/assert.ts";
import { app, dictionary } from "#test-app";
import { getDerivedData } from "../src/model/derived.ts";
import { preloadLookupStatements } from "../src/model/lookup.ts";
import { test } from "./support/test.ts";

/*
 * The lookup statements are all prepared at startup (`preloadLookupStatements()`,
 * called by `createNodeDependencies()`): for each search column and kind of match,
 * the count statements and, per set of fields (2^n, `word` excluded), the priority
 * statement and the other-rows variant the data allows. The field order is
 * canonical, so that no request compiles a new statement, whatever the order of
 * `fields`.
 *
 * SQLite only: D1 compiles its statements itself (`preparedStatementCount` stays at
 * 0), and these tests are skipped there.
 */

const sqlite = dictionary.preparedStatementCount > 0;

test({
  name: "preloadLookupStatements: every variant is prepared at startup",
  ignore: !sqlite,
  fn: async () => {
    const before = dictionary.preparedStatementCount;
    const derived = await getDerivedData(dictionary as never);

    // A second preload finds every statement in the cache.
    const count = preloadLookupStatements(dictionary as never, derived);
    assertEquals(count > 0, true);
    assertEquals(dictionary.preparedStatementCount, before);
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
      "/lookup/*λογος%24?fields=uri&limit=5",
      "/lookup/λογ%3Fς?fields=uri",
      "/lookup/λ*ς?fields=uri&limit=5"
    ];

    for (const request of requests) {
      const response = await app.request(`${request}&skipMorpheus=true`);
      assertEquals(response.status, 200, request);
      await response.body?.cancel();
    }

    assertEquals(dictionary.preparedStatementCount, before);
  }
});
