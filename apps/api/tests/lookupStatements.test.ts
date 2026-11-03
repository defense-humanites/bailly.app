import { assertEquals } from "./support/assert.ts";
import { app, dictionary } from "#test-app";
import { getDerivedData, SEARCH_COLUMNS } from "../src/model/derived.ts";
import { Settings } from "../src/Settings.ts";
import { test } from "./support/test.ts";

/*
 * The lookup statements are all prepared at startup (`preloadLookupStatements()`,
 * called by `createNodeDependencies()`): for each of the 4 search columns and 2
 * operators, the count statements (1, plus the reversed and prefix variants with
 * `GLOB` when the data has them) and, per set of fields (2^n, `word` excluded), the
 * priority statement and the other-rows variants the data allows (plain; ordered
 * and its companion for the columns with a list of unordered rows; reversed), plus
 * the prefix count lookup. The field order is canonical, so that no request
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
  fn: async () => {
    const derived = await getDerivedData(dictionary as never);
    const fieldSets = 2 ** optionalFields.length;
    const hasDerived = derived.prefixCounts || derived.reversedKeys ||
      derived.definitionLength || derived.unordered.size > 0;

    // The statements that read the derived data (`getDerivedData()`) go through the
    // same cache: two without derived data, three with.
    let expected = (hasDerived ? 3 : 2) + (derived.prefixCounts ? 1 : 0);

    for (const column of SEARCH_COLUMNS) {
      // `=`: one count, one priority and one other statement per field set.
      expected += 1 + 2 * fieldSets;
      // `GLOB`: the variants.
      const ordered = derived.unordered.has(column) ? 2 : 0;
      const reversed = derived.reversedKeys ? 1 : 0;
      expected += 1 + reversed + (derived.prefixCounts ? 1 : 0) +
        fieldSets * (2 + ordered + reversed);
    }

    assertEquals(dictionary.preparedStatementCount, expected);
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
