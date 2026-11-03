/**
 * Loads the current database revision (`DATABASE.filePath`, cf. `src/defaults.ts`)
 * into the *local* D1 database of `wrangler.jsonc` (binding `DB`), the one
 * `wrangler dev` and the `workers` tests use (`.wrangler/state/v3/d1/`).
 *
 * Miniflare keeps a local D1 database as a plain SQLite file: rather than replaying
 * a 200 MB SQL dump through `wrangler d1 execute --file`, the script copies the
 * `bailly` table and its indexes into that file directly (`ATTACH`), in a few
 * seconds. The production database is imported differently (cf. `README.md`).
 *
 * Usage: `npm run d1:local`. Idempotent: the table is replaced.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATABASE } from "../src/defaults.ts";

const DATABASE_NAME = "bailly-dictionary";
const PERSIST_PATH = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

if (!existsSync(DATABASE.filePath)) {
  console.error(
    `❌ ${DATABASE.filePath} not found: start the Node.js server once (it decompresses ` +
      "the archive), or decompress it yourself."
  );
  process.exit(1);
}

// Let Wrangler create the local database (the file is named after an identifier
// derived by workerd: it cannot be computed here, only found).
const created = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", DATABASE_NAME, "--local", "--command", "SELECT 1"],
  { stdio: ["ignore", "ignore", "inherit"] }
);

if (created.status !== 0) {
  console.error("❌ `wrangler d1 execute --local` failed.");
  process.exit(1);
}

const files = readdirSync(PERSIST_PATH)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite");

if (files.length !== 1) {
  console.error(
    `❌ Expected one local D1 database in ${PERSIST_PATH}, found ${files.length}: ` +
      `${files.join(", ") || "none"}. Delete the directory and run again.`
  );
  process.exit(1);
}

const localPath = join(PERSIST_PATH, files[0]!);
const db = new DatabaseSync(localPath);

console.info(`⏳ Copying ${DATABASE.filePath} into ${localPath}...`);
const start = performance.now();

// One big transaction, in rollback-journal mode (a WAL would hold the whole copy);
// set before attaching the read-only source, which the pragma would otherwise reach.
db.exec("PRAGMA journal_mode = DELETE");
db.exec(
  `ATTACH DATABASE 'file:${encodeURI(DATABASE.filePath)}?mode=ro' AS src`
);

// The tables (`bailly` and the derived ones, cf. `scripts/db_derive.ts`) and their
// indexes, as the source defines them.
const schema = db.prepare(
  `SELECT type, name, tbl_name AS table_name, sql FROM src.sqlite_master
   WHERE sql IS NOT NULL AND tbl_name LIKE 'bailly%'
   ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
).all() as { type: string; name: string; table_name: string; sql: string }[];

const tables = schema.filter(({ type }) => type === "table");

if (!tables.some(({ name }) => name === "bailly")) {
  console.error("❌ No `bailly` table in the source database.");
  process.exit(1);
}

db.exec("BEGIN");
for (const { name } of tables) db.exec(`DROP TABLE IF EXISTS main.${name}`);
for (const { sql } of schema) db.exec(sql);
for (const { name } of tables) {
  db.exec(`INSERT INTO main.${name} SELECT * FROM src.${name}`);
}
db.exec("COMMIT");
db.exec("DETACH DATABASE src");
db.exec("PRAGMA journal_mode = WAL");

const { count } = db.prepare("SELECT COUNT(*) AS count FROM bailly").get() as {
  count: number;
};
db.close();

console.info(
  `✅ ${count.toLocaleString("en")} rows, ${tables.length} tables and ${
    schema.length - tables.length
  } indexes copied in ${((performance.now() - start) / 1000).toFixed(1)} s.`
);
