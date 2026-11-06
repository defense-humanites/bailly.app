/**
 * The Greek stem data of Morpheus (Alpheios dataset), as the WebAssembly module
 * expects it: `[path, bytes]` entries under `Greek/…`.
 *
 * Only the files the runtime reads are kept (`RUNTIME_FILE_PATTERNS`, from the
 * binding's README): the Alpheios tree also carries the sources of the stem
 * indexes and various working files, which would double the data for nothing.
 *
 * Node.js reads the directory acquired by `npm run morpheus:data` (`loadStemlib()`);
 * the Worker bundles the same files as Data modules (cf. `scripts/morpheus_data.ts`,
 * which generates `src/morpheus/stemlib-manifest.ts`).
 */

import type { StemlibEntries } from "@libmorpheus/wasm";

/** The Alpheios dataset only has Greek. */
export const LANGUAGE_DIRECTORY = "Greek";

/** Paths (relative to the language directory) of the files the runtime reads. */
export const RUNTIME_FILE_PATTERNS: readonly RegExp[] = [
  /^rule_files\/[^/]+\.table$/,
  /^steminds\/(nomind|nomind\.lindex|vbind|vbind\.lindex)$/,
  /^endtables\/indices\/[^/]+$/,
  /^endtables\/out\/[^/]+$/,
  /^derivs\/indices\/derivind$/,
  /^stemsrc\/(vbs\.cmp\.ml|lemlist)$/
];

/** Whether a path (relative to the language directory) is read by the runtime. */
export function isRuntimeFile(relativePath: string): boolean {
  return RUNTIME_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

/**
 * Reads the runtime subset of the stem data from `directory` (the output of
 * `npm run morpheus:data`, which contains `Greek/`). Node.js only.
 */
export async function loadStemlib(directory: string): Promise<StemlibEntries> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, relative, sep } = await import("node:path");

  const languageDirectory = join(directory, LANGUAGE_DIRECTORY);
  const entries: [string, Uint8Array][] = [];

  for (
    const entry of await readdir(languageDirectory, {
      recursive: true,
      withFileTypes: true
    })
  ) {
    if (!entry.isFile()) continue;

    const path = join(entry.parentPath, entry.name);
    const relativePath = relative(languageDirectory, path).split(sep).join("/");

    if (!isRuntimeFile(relativePath)) continue;

    entries.push([`${LANGUAGE_DIRECTORY}/${relativePath}`, await readFile(path)]);
  }

  if (!entries.length) {
    throw new Error(
      `No Morpheus stem data in '${languageDirectory}': run \`npm run morpheus:data\`.`
    );
  }

  return entries;
}
