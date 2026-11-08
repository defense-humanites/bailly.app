/**
 * Exports the current database revision (`DATABASE.filePath`, cf. `src/defaults.ts`)
 * as a SQL file for the import into the hosted D1 database:
 *
 *   pnpm exec wrangler d1 execute DB --remote --file=database/bailly-revN.sql
 *
 * D1 imports plain SQL only (no SQLite file), without `BEGIN`/`COMMIT`, and refuses
 * any statement over 100 KB. The rows are thus inserted by batches under
 * `STATEMENT_MAX_BYTES`, and the few rows that alone exceed it (18 definitions of
 * more than 90 KB) are inserted with their long texts truncated, then completed by
 * `UPDATE … SET column = column || '…'`. The indexes are created after the data
 * (faster), and the tables are dropped first, so that the import can be replayed.
 *
 * `--tables=a,b` exports only these tables (and their indexes), e.g. a table added
 * by a new revision whose other tables are unchanged (revision 6: `bailly_form`),
 * imported into the current D1 database without replaying the whole revision.
 *
 * Usage: `pnpm run d1:export [--tables=a,b] [output.sql]` (default: the database
 * path, `.sql`, or `<path>-<tables>.sql`).
 */

import { createWriteStream } from "node:fs";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { DATABASE } from "../src/defaults.ts";

/** D1's limit is 100 KB per statement: keep a margin. */
const STATEMENT_MAX_BYTES = 90_000;

const args = process.argv.slice(2);
const only = args.find((arg) => arg.startsWith("--tables="))
  ?.slice("--tables=".length).split(",").filter(Boolean);
const outputPath = args.find((arg) => !arg.startsWith("--")) ??
  DATABASE.filePath.replace(/\.db$/, "") + (only ? `-${only.join("-")}` : "") + ".sql";

const db = new DatabaseSync(`file:${DATABASE.filePath}?immutable=1`, {
  readOnly: true
});

const schema = (db.prepare(
  `SELECT type, name, tbl_name AS tableName, sql FROM sqlite_master
   WHERE sql IS NOT NULL AND tbl_name LIKE 'bailly%'
   ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
).all() as { type: string; name: string; tableName: string; sql: string }[])
  .filter(({ tableName }) => !only || only.includes(tableName));

const tables = schema.filter(({ type }) => type === "table");
const indexes = schema.filter(({ type }) => type === "index");

const missing = (only ?? ["bailly"]).filter(
  (table) => !tables.some(({ name }) => name === table)
);
if (missing.length) {
  console.error(`❌ No ${missing.map((table) => `\`${table}\``).join(", ")} table in ${DATABASE.filePath}.`);
  process.exit(1);
}

const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

function literal(value: SQLOutputValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  return `X'${Buffer.from(value).toString("hex")}'`;
}

/** Splits a text into pieces whose literals stay under `maxBytes` (whole characters). */
function split(text: string, maxBytes: number): string[] {
  const pieces: string[] = [];
  let piece = "";
  let size = 0;

  for (const character of text) {
    const characterSize = bytes(character) * (character === "'" ? 2 : 1);
    if (size + characterSize > maxBytes) {
      pieces.push(piece);
      piece = "";
      size = 0;
    }
    piece += character;
    size += characterSize;
  }

  pieces.push(piece);
  return pieces;
}

const output = createWriteStream(outputPath);
const write = (statement: string) => {
  if (bytes(statement) > STATEMENT_MAX_BYTES + 1_000) {
    throw new Error(`Statement over the limit: ${statement.slice(0, 200)}…`);
  }
  output.write(`${statement};\n`);
};

let statementCount = 0;
let splitRows = 0;

for (const { name } of [...tables].reverse()) write(`DROP TABLE IF EXISTS ${name}`);
for (const { sql } of tables) write(sql.trim());
statementCount += tables.length * 2;

for (const { name } of tables) {
  const columns = (db.prepare(`PRAGMA table_info(${name})`).all() as {
    name: string;
    pk: number;
  }[]);
  const columnList = columns.map((column) => column.name).join(", ");
  const head = `INSERT INTO ${name} (${columnList}) VALUES\n`;
  const keyColumns = columns.filter((column) => column.pk > 0).map((c) => c.name);

  let batch: string[] = [];
  let batchSize = bytes(head);

  const flush = () => {
    if (!batch.length) return;
    write(head + batch.join(",\n"));
    statementCount++;
    batch = [];
    batchSize = bytes(head);
  };

  for (const row of db.prepare(`SELECT ${columnList} FROM ${name}`).iterate()) {
    const values = columns.map((column) => row[column.name] as SQLOutputValue);
    const tuple = `(${values.map(literal).join(", ")})`;
    const tupleSize = bytes(tuple) + 2;

    if (bytes(head) + tupleSize <= STATEMENT_MAX_BYTES) {
      if (batchSize + tupleSize > STATEMENT_MAX_BYTES) flush();
      batch.push(tuple);
      batchSize += tupleSize;
      continue;
    }

    // A row too large for one statement: its long texts are written in pieces.
    flush();
    splitRows++;

    // Its long texts are inserted empty, then appended piece by piece.
    const pieces = values.map((value) =>
      typeof value === "string" && bytes(value) > 1_000
        ? split(value, STATEMENT_MAX_BYTES / 2)
        : null
    );
    const first = values.map((value, i) => (pieces[i] ? "" : value));
    write(`${head}(${first.map(literal).join(", ")})`);
    statementCount++;

    const where = keyColumns
      .map((key) => `${key} = ${literal(row[key] as SQLOutputValue)}`)
      .join(" AND ");

    columns.forEach((column, i) => {
      for (const piece of pieces[i] ?? []) {
        write(
          `UPDATE ${name} SET ${column.name} = ${column.name} || ${literal(piece)} ` +
            `WHERE ${where}`
        );
        statementCount++;
      }
    });
  }

  flush();
}

for (const { sql } of indexes) write(sql.trim());
statementCount += indexes.length;

await new Promise<void>((resolve, reject) =>
  output.end((error?: Error | null) => (error ? reject(error) : resolve()))
);

console.info(
  `✅ ${outputPath}: ${statementCount.toLocaleString("en")} statements ` +
    `(${splitRows} rows written in pieces), ${tables.length} tables, ` +
    `${indexes.length} indexes.`
);
