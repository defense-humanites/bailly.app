/**
 * Compresses the current database revision (`DATABASE.filePath`, cf.
 * `src/defaults.ts`) into the `.gz` archive that is committed and deployed (the
 * database itself is ignored by git and decompressed at startup).
 *
 * Usage: `deno task db:pack [--force]`. Without `--force`, an archive more recent than
 * the database is kept as is.
 */

import { DATABASE } from "../src/defaults.ts";

const dbPath = DATABASE.filePath;
const gzPath = `${dbPath}.gz`;
const force = Deno.args.includes("--force");

const stat = (path: string) => Deno.stat(path).catch(() => undefined);

async function sha256(stream: ReadableStream<Uint8Array>): Promise<string> {
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const db = await stat(dbPath);
const gz = await stat(gzPath);

if (!db) {
  console.error(
    gz
      ? `${dbPath} not found, but ${gzPath} exists: nothing to compress.`
      : `❌ Neither ${dbPath} nor ${gzPath} exist.`
  );
  Deno.exit(gz ? 0 : 1);
}

if (gz && !force && (gz.mtime?.getTime() ?? 0) >= (db.mtime?.getTime() ?? 0)) {
  console.info(`${gzPath} is up to date (use --force to recompress).`);
  Deno.exit(0);
}

// Write to a temporary file, then rename: an interrupted run never leaves a
// truncated archive in place.
const tmpPath = `${gzPath}.tmp`;
{
  const input = await Deno.open(dbPath);
  const output = await Deno.create(tmpPath);
  await input.readable
    .pipeThrough(new CompressionStream("gzip"))
    .pipeTo(output.writable);
}

// Check the archive against the database before replacing the previous one.
const [expected, actual] = await Promise.all([
  Deno.open(dbPath).then((file) => sha256(file.readable)),
  Deno.open(tmpPath).then((file) =>
    sha256(file.readable.pipeThrough(new DecompressionStream("gzip")))
  )
]);

if (expected !== actual) {
  await Deno.remove(tmpPath);
  console.error("❌ The archive doesn't match the database (checksum mismatch).");
  Deno.exit(1);
}

await Deno.rename(tmpPath, gzPath);

const size = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
console.info(
  `✅ ${gzPath} (${size((await Deno.stat(gzPath)).size)}, from ${size(db.size)}).\n` +
    `   Don't forget to commit it: git add ${gzPath}`
);
