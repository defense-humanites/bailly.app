/**
 * Derives, from a revision of the dictionary database, the data the lookups need to
 * read as few rows as possible (which D1 bills, and which costs CPU on SQLite):
 *
 *   1. `bailly_unordered(column, orderedID)`: for a search column, the rows whose
 *      position in the column's index order (the key, then `orderedID`) is not that of
 *      the dictionary order (`orderedID`), i.e. the rows outside the longest common
 *      increasing subsequence of the two orders. When this set is small (the
 *      case-insensitive atonic column: a few dozen rows), the "other matches" of a
 *      lookup can be read in index order, excluding these rows, and stop at `LIMIT`
 *      instead of reading and sorting every match (cf. `buildOtherLookupSql()`); the
 *      excluded rows are fetched apart. Columns whose set is too large (the
 *      case-sensitive ones: capitals sort before lowercase letters; the diacritic
 *      ones) are left out, and keep the sorting statement.
 *   2. `bailly_prefix_count(column, prefix, count)`: the number of rows of each
 *      search column beginning with each prefix of 1 to `PREFIX_MAX_LENGTH` letters,
 *      so that `countAll` of a prefix lookup is a one-row read instead of a count over
 *      every match (54 536 rows for `α`).
 *   3. `reversedSearchable*` columns, indexed: the search keys reversed, so that a
 *      lookup by the end of the word (`*λογος`) is a prefix lookup on them instead of
 *      a scan of the whole table.
 *   4. `definitionLength`: the length of `definition`, indexed, for the random entry
 *      with a `lengthRange`.
 *   5. `bailly_form(form, uris)`: the forms linked to several entries in the
 *      definitions (`span[data-linked-entries]`), with their URIs, for the page of a
 *      form (`GET /form/:form`, cf. `src/model/form.ts`). A form must have the same
 *      URIs wherever it is linked: the derivation fails otherwise.
 *
 * The result is a new revision file (`<source> → <output>`), the source being left
 * untouched; `bailly` keeps its rows and its columns. The same derivation belongs,
 * eventually, to the data converter.
 *
 * Usage: node scripts/db_derive.ts database/bailly-rev4.db database/bailly-rev5.db
 */

import { copyFileSync, existsSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  linkedForms,
  reverseKey,
  SEARCH_COLUMNS,
  UNORDERED_MAX_ROWS
} from "../src/model/derived.ts";

const PREFIX_MAX_LENGTH = 4;

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  console.error("usage: node scripts/db_derive.ts <source.db> <output.db>");
  process.exit(2);
}
if (!existsSync(source)) {
  console.error(`❌ ${source} not found.`);
  process.exit(1);
}

for (const path of [output, `${output}-journal`, `${output}-wal`, `${output}-shm`]) {
  rmSync(path, { force: true });
}
copyFileSync(source, output);

const db = new DatabaseSync(output);
db.exec("PRAGMA journal_mode = OFF");
db.exec("PRAGMA synchronous = OFF");

const time = (label: string, fn: () => void) => {
  const start = performance.now();
  fn();
  console.info(`  ${label}: ${((performance.now() - start) / 1000).toFixed(1)} s`);
};

const rowCount = (db.prepare("SELECT COUNT(*) AS n FROM bailly").get() as { n: number })
  .n;
console.info(`${source} → ${output} (${rowCount.toLocaleString("en")} rows)`);

/** Indices of the longest strictly increasing subsequence of `values`. */
function longestIncreasingSubsequence(values: readonly number[]): Set<number> {
  // tailIndex[k]: index of the smallest tail of a subsequence of length k + 1.
  const tailIndex: number[] = [];
  const previous = new Array<number>(values.length).fill(-1);

  for (let i = 0; i < values.length; i++) {
    let low = 0;
    let high = tailIndex.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (values[tailIndex[mid]!]! < values[i]!) low = mid + 1;
      else high = mid;
    }
    previous[i] = low > 0 ? tailIndex[low - 1]! : -1;
    tailIndex[low] = i;
  }

  const members = new Set<number>();
  for (let i = tailIndex.at(-1) ?? -1; i !== -1; i = previous[i]!) members.add(i);
  return members;
}

// 1. Rows outside the longest common increasing subsequence, per column.
db.exec("DROP TABLE IF EXISTS bailly_unordered");
db.exec(`
  CREATE TABLE bailly_unordered (
    column TEXT NOT NULL,
    orderedID INTEGER NOT NULL,
    PRIMARY KEY (column, orderedID)
  ) WITHOUT ROWID
`);

const insertUnordered = db.prepare(
  "INSERT INTO bailly_unordered (column, orderedID) VALUES (?1, ?2)"
);

for (const column of SEARCH_COLUMNS) {
  time(`bailly_unordered.${column}`, () => {
    const ids = (db.prepare(
      `SELECT orderedID FROM bailly ORDER BY ${column}, orderedID`
    ).all() as { orderedID: number }[]).map((row) => row.orderedID);

    const kept = longestIncreasingSubsequence(ids);
    const excluded = ids.filter((_, index) => !kept.has(index));

    if (excluded.length > UNORDERED_MAX_ROWS) {
      console.info(
        `    ${excluded.length} rows out of order: not stored (keeps the sort).`
      );
      return;
    }

    db.exec("BEGIN");
    for (const orderedID of excluded) insertUnordered.run(column, orderedID);
    db.exec("COMMIT");
    console.info(`    ${excluded.length} rows out of order, stored.`);
  });
}

// 2. Prefix counts.
db.exec("DROP TABLE IF EXISTS bailly_prefix_count");
db.exec(`
  CREATE TABLE bailly_prefix_count (
    column TEXT NOT NULL,
    prefix TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (column, prefix)
  ) WITHOUT ROWID
`);

const insertCount = db.prepare(
  "INSERT INTO bailly_prefix_count (column, prefix, count) VALUES (?1, ?2, ?3)"
);

for (const column of SEARCH_COLUMNS) {
  time(`bailly_prefix_count.${column}`, () => {
    const counts = new Map<string, number>();

    for (
      const { key } of db.prepare(`SELECT ${column} AS key FROM bailly`).all() as {
        key: string;
      }[]
    ) {
      const letters = [...key];
      const longest = Math.min(PREFIX_MAX_LENGTH, letters.length);
      for (let length = 1; length <= longest; length++) {
        const prefix = letters.slice(0, length).join("");
        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
      }
    }

    db.exec("BEGIN");
    for (const [prefix, count] of counts) insertCount.run(column, prefix, count);
    db.exec("COMMIT");
    console.info(`    ${counts.size.toLocaleString("en")} prefixes.`);
  });
}

// 3. Reversed keys, 4. definition length.
const columns = (db.prepare("PRAGMA table_info(bailly)").all() as { name: string }[])
  .map(({ name }) => name);

time("reversed keys and definition length", () => {
  db.exec("BEGIN");

  for (const column of SEARCH_COLUMNS) {
    const reversed = reverseKeyColumn(column);
    if (!columns.includes(reversed)) {
      db.exec(`ALTER TABLE bailly ADD COLUMN ${reversed} TEXT`);
    }
  }
  if (!columns.includes("definitionLength")) {
    db.exec("ALTER TABLE bailly ADD COLUMN definitionLength INTEGER");
  }

  const update = db.prepare(`
    UPDATE bailly SET
      ${SEARCH_COLUMNS.map((column, i) => `${reverseKeyColumn(column)} = ?${i + 2}`).join(", ")},
      definitionLength = ?${SEARCH_COLUMNS.length + 2}
    WHERE orderedID = ?1
  `);

  const rows = db.prepare(
    `SELECT orderedID, ${SEARCH_COLUMNS.join(", ")}, length(definition) AS length FROM bailly`
  ).all() as Record<string, string | number>[];

  for (const row of rows) {
    update.run(
      row.orderedID!,
      ...SEARCH_COLUMNS.map((column) => reverseKey(String(row[column]))),
      row.length!
    );
  }

  for (const column of SEARCH_COLUMNS) {
    const reversed = reverseKeyColumn(column);
    db.exec(`CREATE INDEX IF NOT EXISTS ix_bailly_${reversed} ON bailly (${reversed})`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS ix_bailly_definitionLength ON bailly (definitionLength)");

  db.exec("COMMIT");
});

// 5. Linked forms.
db.exec("DROP TABLE IF EXISTS bailly_form");
db.exec(`
  CREATE TABLE bailly_form (
    form TEXT NOT NULL PRIMARY KEY,
    uris TEXT NOT NULL
  ) WITHOUT ROWID
`);

time("bailly_form", () => {
  const forms = new Map<string, string>();
  const conflicts = new Map<string, Set<string>>();

  for (
    const { uri, html } of db.prepare(
      `SELECT uri, htmlDefinition AS html FROM bailly
       WHERE htmlDefinition LIKE '%data-linked-entries%' ORDER BY orderedID`
    ).all() as { uri: string; html: string }[]
  ) {
    for (const { form, uris } of linkedForms(html)) {
      const list = uris.join(",");
      const known = forms.get(form);
      if (known === undefined) forms.set(form, list);
      else if (known !== list) {
        conflicts.set(form, (conflicts.get(form) ?? new Set([known])).add(`${list} (${uri})`));
      }
    }
  }

  if (conflicts.size) {
    console.error(`❌ ${conflicts.size} forms linked to different entries:`);
    for (const [form, lists] of [...conflicts].slice(0, 20)) {
      console.error(`    ${form}: ${[...lists].join(" | ")}`);
    }
    process.exit(1);
  }

  const insert = db.prepare("INSERT INTO bailly_form (form, uris) VALUES (?1, ?2)");
  db.exec("BEGIN");
  for (const [form, uris] of forms) insert.run(form, uris);
  db.exec("COMMIT");
  console.info(`    ${forms.size.toLocaleString("en")} forms.`);
});

time("VACUUM", () => {
  db.exec("VACUUM");
});
db.close();

console.info(`✅ ${output}`);

function reverseKeyColumn(column: string): string {
  return `reversed${column.charAt(0).toUpperCase()}${column.slice(1)}`;
}
