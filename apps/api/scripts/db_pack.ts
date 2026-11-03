/**
 * Compresses the current database revision (`DATABASE.filePath`, cf.
 * `src/defaults.ts`) into the `.gz` archive that is committed (the database itself
 * is ignored by git and decompressed at startup on Node.js).
 *
 * Usage: `npm run db:pack [-- --force]`. Without `--force`, an archive more recent
 * than the database is kept as is.
 */

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { DATABASE } from "../src/defaults.ts";

const dbPath = DATABASE.filePath;
const gzPath = `${dbPath}.gz`;
const force = process.argv.includes("--force");

const statOrUndefined = (path: string) => stat(path).catch(() => undefined);

async function sha256(...streams: NodeJS.ReadableStream[]): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(...(streams as [NodeJS.ReadableStream]), hash);
  return hash.digest("hex");
}

const db = await statOrUndefined(dbPath);
const gz = await statOrUndefined(gzPath);

if (!db) {
  console.error(
    gz
      ? `${dbPath} not found, but ${gzPath} exists: nothing to compress.`
      : `❌ Neither ${dbPath} nor ${gzPath} exist.`
  );
  process.exit(gz ? 0 : 1);
}

if (gz && !force && gz.mtimeMs >= db.mtimeMs) {
  console.info(`${gzPath} is up to date (use --force to recompress).`);
  process.exit(0);
}

// Write to a temporary file, then rename: an interrupted run never leaves a
// truncated archive in place.
const tmpPath = `${gzPath}.tmp`;
await pipeline(createReadStream(dbPath), createGzip(), createWriteStream(tmpPath));

// Check the archive against the database before replacing the previous one.
const [expected, actual] = await Promise.all([
  sha256(createReadStream(dbPath)),
  sha256(createReadStream(tmpPath), createGunzip())
]);

if (expected !== actual) {
  await rm(tmpPath);
  console.error("❌ The archive doesn't match the database (checksum mismatch).");
  process.exit(1);
}

await rename(tmpPath, gzPath);

const size = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
console.info(
  `✅ ${gzPath} (${size((await stat(gzPath)).size)}, from ${size(db.size)}).\n` +
    `   Don't forget to commit it: git add ${gzPath}`
);
