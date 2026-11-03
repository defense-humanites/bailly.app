/**
 * Checks that the optimized lookup (`src/model/lookup.ts`, with the derived data of
 * `scripts/db_derive.ts`) gives exactly the same responses as the reference
 * implementation (`scripts/reference/lookup.ts`, the plain statements), over:
 *
 *   - every prefix of 1 to 5 letters of the default search column, with limits 5,
 *     30 and 100 (`λογ`: prefix lookup, precomputed count, ordered variant);
 *   - every suffix of 2 to 4 letters, limit 30 (`λογος$`: reversed keys);
 *   - every prefix of 1 to 3 letters of the three other columns, limit 30;
 *   - samples of exact lookups (`"λόγος"`) and of lookups with Morpheus.
 *
 * Usage (development only; the database with the derived data, the stem data):
 *   node scripts/compare_lookups.ts [sample size]
 */

import { SqliteDictionary } from "../src/db/sqlite.ts";
import { DATABASE } from "../src/defaults.ts";
import type { ApiLookupParams, QueryableFields } from "../src/definitions.ts";
import { getDerivedData, SEARCH_COLUMNS } from "../src/model/derived.ts";
import { getEntries, preloadLookupStatements } from "../src/model/lookup.ts";
import { createNodeMorpheus } from "../src/node/dependencies.ts";
import { Morpheus } from "../src/Morpheus.ts";
import { Settings } from "../src/Settings.ts";
import { getEntries as getReferenceEntries } from "./reference/lookup.ts";

const sampleSize = Number(process.argv[2] ?? 3000);

const settings = Settings.configure({
  API_ENV: "production",
  QUERY_ALLOWED_FIELDS: "word,uri,htmlDefinition,definition,htmlExcerpt,excerpt",
  QUERY_DEFAULT_FIELDS: "word,uri,excerpt",
  QUERY_MAX_ROWS: "100"
});

const db = await SqliteDictionary.open(DATABASE.filePath);
const derived = await getDerivedData(db);
preloadLookupStatements(db, derived);

if (!derived.prefixCounts || !derived.reversedKeys || !derived.unordered.size) {
  console.error(`❌ ${DATABASE.filePath} has no derived data: nothing to compare.`);
  process.exit(1);
}

const morpheus = await createNodeMorpheus(settings);
const noMorpheus = new Morpheus();

type Params = ApiLookupParams<keyof QueryableFields>;

const baseParams = (q: string): Params => ({
  q,
  inputMode: "greek",
  fields: ["word", "uri", "excerpt"],
  morphology: true,
  caseSensitive: false,
  diacriticSensitive: false,
  skipMorpheus: true
});

type Case = { params: Params; morpheus: Morpheus; label: string };
const cases: Case[] = [];

const columnOptions = (column: string) => ({
  caseSensitive: column === "searchable" || column === "searchableAtonic",
  diacriticSensitive: column === "searchable" || column === "searchableCaseInsensitive"
});

const prefixes = (column: string, lengths: number[]): string[] => {
  const keys = (db.connection.prepare(`SELECT DISTINCT ${column} AS key FROM bailly`)
    .all() as { key: string }[]).map(({ key }) => [...key]);
  const set = new Set<string>();
  for (const letters of keys) {
    for (const length of lengths) {
      if (letters.length >= length) set.add(letters.slice(0, length).join(""));
    }
  }
  return [...set];
};

const suffixes = (column: string, lengths: number[]): string[] => {
  const keys = (db.connection.prepare(`SELECT DISTINCT ${column} AS key FROM bailly`)
    .all() as { key: string }[]).map(({ key }) => [...key]);
  const set = new Set<string>();
  for (const letters of keys) {
    for (const length of lengths) {
      if (letters.length >= length) set.add(letters.slice(-length).join(""));
    }
  }
  return [...set];
};

// Prefixes of the default column, three limits.
for (const prefix of prefixes(SEARCH_COLUMNS[0], [1, 2, 3, 4, 5])) {
  for (const limit of [5, 30, 100]) {
    cases.push({
      params: { ...baseParams(prefix), limit },
      morpheus: noMorpheus,
      label: `${prefix} limit=${limit}`
    });
  }
}

// Suffixes of the default column.
for (const suffix of suffixes(SEARCH_COLUMNS[0], [2, 3, 4])) {
  cases.push({
    params: { ...baseParams(`${suffix}$`), limit: 30 },
    morpheus: noMorpheus,
    label: `${suffix}$ limit=30`
  });
}

// Short prefixes of the other columns.
for (const column of SEARCH_COLUMNS.slice(1)) {
  for (const prefix of prefixes(column, [1, 2, 3])) {
    cases.push({
      params: { ...baseParams(prefix), ...columnOptions(column), limit: 30 },
      morpheus: noMorpheus,
      label: `${prefix} ${column} limit=30`
    });
  }
}

// Samples: exact lookups, and lookups with Morpheus (every column).
const words = (db.connection.prepare(
  "SELECT searchableAtonicCaseInsensitive AS key FROM bailly ORDER BY random() LIMIT ?1"
).all(sampleSize) as { key: string }[]).map(({ key }) => key);

for (const word of words) {
  cases.push({
    params: { ...baseParams(`"${word}"`), limit: 30 },
    morpheus: noMorpheus,
    label: `"${word}" limit=30`
  });
  for (const column of SEARCH_COLUMNS) {
    cases.push({
      params: { ...baseParams(word), ...columnOptions(column), skipMorpheus: false, limit: 30 },
      morpheus,
      label: `${word} ${column} morpheus limit=30`
    });
  }
  cases.push({
    params: { ...baseParams(`${word}$`), skipMorpheus: false, limit: 30 },
    morpheus,
    label: `${word}$ morpheus limit=30`
  });
}

console.info(`Comparing ${cases.length.toLocaleString("en")} lookups...`);

const timings = { optimized: 0, reference: 0 };
const differences: string[] = [];
const start = performance.now();

for (const [index, { params, morpheus, label }] of cases.entries()) {
  let t = performance.now();
  const optimized = JSON.stringify(await getEntries(db, morpheus, params));
  timings.optimized += performance.now() - t;

  t = performance.now();
  const reference = JSON.stringify(await getReferenceEntries(db, morpheus, params));
  timings.reference += performance.now() - t;

  if (optimized !== reference) {
    differences.push(label);
    if (differences.length <= 5) {
      console.error(`❌ ${label}\n   optimized: ${optimized.slice(0, 300)}\n   reference: ${reference.slice(0, 300)}`);
    }
  }

  if ((index + 1) % 5000 === 0) {
    console.info(`  ${(index + 1).toLocaleString("en")} lookups, ${differences.length} differences`);
  }
}

console.info(
  `${cases.length.toLocaleString("en")} lookups in ${((performance.now() - start) / 1000).toFixed(0)} s ` +
    `(optimized ${(timings.optimized / cases.length).toFixed(2)} ms, ` +
    `reference ${(timings.reference / cases.length).toFixed(2)} ms per lookup).`
);

if (differences.length) {
  console.error(`❌ ${differences.length} differences: ${differences.slice(0, 50).join(", ")}`);
  process.exit(1);
}

console.info("✅ Identical responses.");
