/**
 * Compares the Morpheus results of the API (`Morpheus.lookup()`, with the variants
 * and readings it submits and drops) between two lemmatizers, over every headword of
 * the dictionary (as `GET /lookup/<word>` without diacritics would analyze it):
 *
 *   - the WebAssembly module (`@libmorpheus/wasm`, what the API deploys);
 *   - the native library through `@libmorpheus/node` (the FFI path of the previous
 *     API), from a directory holding `lib/libmorpheus.so` (or `.dylib`).
 *
 * Usage (development only; a few minutes):
 *   node scripts/compare_lemmatizers.ts <native library root> [limit]
 *
 * Both must give exactly the same analyses, in the same order: the decoding of the
 * numeric codes (`src/morpheus/decode.ts`) and the module are then equivalent to the
 * native binding. Differences are listed with the first differing key.
 */

import {
  MorpheusLanguage,
  MorpheusLibrary,
  type MorpheusAnalysis as NativeAnalysis
} from "@libmorpheus/node";
import { nativeLibraryPath } from "@libmorpheus/node/native";
import { SqliteDictionary } from "../src/db/sqlite.ts";
import { DATABASE } from "../src/defaults.ts";
import { Morpheus } from "../src/Morpheus.ts";
import type {
  AnalyzeOptions,
  Lemmatizer,
  MorpheusAnalysis
} from "../src/morpheus/lemmatizer.ts";
import { loadStemlib } from "../src/morpheus/stemlib.ts";
import { WasmLemmatizer } from "../src/morpheus/wasm.ts";
import { Settings } from "../src/Settings.ts";

const [nativeRoot, limitArg] = process.argv.slice(2);
if (!nativeRoot) {
  console.error("usage: node scripts/compare_lemmatizers.ts <native library root> [limit]");
  process.exit(2);
}
const limit = limitArg ? Number(limitArg) : Infinity;

Settings.configure({ API_ENV: "production" });
const dataPath = process.env.MORPHEUS_DATA_PATH?.trim() || "morpheus-data";

/** `Lemmatizer` over the native library (the same named analyses, by the binding). */
class NativeLemmatizer implements Lemmatizer {
  readonly #context;

  constructor(libraryPath: string, stemlibPath: string) {
    const library = new MorpheusLibrary(libraryPath);
    this.#context = library.createContext(stemlibPath, MorpheusLanguage.Greek);
  }

  async analyze(betaCode: string, options: AnalyzeOptions): Promise<MorpheusAnalysis[]> {
    let flags = 0n;
    if (options.strictCase) flags |= 1n << 0n;
    if (options.ignoreAccents) flags |= 1n << 1n;
    const analyses: readonly NativeAnalysis[] = await this.#context.analyze(betaCode, flags);
    return analyses.map((analysis) => ({ ...analysis }));
  }
}

const wasm = new Morpheus(
  await WasmLemmatizer.create({ stemlib: () => loadStemlib(dataPath) })
);
const native = new Morpheus(new NativeLemmatizer(nativeLibraryPath(nativeRoot), dataPath));

const db = await SqliteDictionary.open(DATABASE.filePath);
const words = (await db.all<{ key: string }>(
  "SELECT DISTINCT searchableAtonicCaseInsensitive AS key FROM bailly ORDER BY key"
)).map(({ key }) => key).slice(0, limit);

console.info(`Comparing ${words.length.toLocaleString("en")} forms...`);

const options = { caseSensitive: false, diacriticSensitive: false };
const differences: string[] = [];
let analyses = 0;
const timings = { wasm: 0, native: 0 };
const start = performance.now();

for (const [index, word] of words.entries()) {
  let t = performance.now();
  const fromWasm = await wasm.lookup(word, options);
  timings.wasm += performance.now() - t;

  t = performance.now();
  const fromNative = await native.lookup(word, options);
  timings.native += performance.now() - t;

  const a = JSON.stringify(fromWasm);
  const b = JSON.stringify(fromNative);
  analyses += Object.values(fromWasm).flat().length;

  if (a !== b) {
    const keysA = Object.keys(fromWasm);
    const keysB = Object.keys(fromNative);
    const key = keysA.find((k) => !keysB.includes(k) || JSON.stringify(fromWasm[k]) !== JSON.stringify(fromNative[k])) ??
      keysB.find((k) => !keysA.includes(k)) ?? "?";
    differences.push(`${word}: ${key} (wasm ${keysA.length} lemmas, native ${keysB.length})`);
  }

  if ((index + 1) % 10000 === 0) {
    console.info(`  ${(index + 1).toLocaleString("en")} forms, ${differences.length} differences`);
  }
}

const seconds = (performance.now() - start) / 1000;
console.info(
  `${words.length.toLocaleString("en")} forms, ${analyses.toLocaleString("en")} analyses ` +
    `in ${seconds.toFixed(0)} s (wasm ${(timings.wasm / words.length).toFixed(2)} ms/form, ` +
    `native ${(timings.native / words.length).toFixed(2)} ms/form).`
);

if (differences.length) {
  console.error(`❌ ${differences.length} differences:`);
  for (const difference of differences.slice(0, 50)) console.error(`  ${difference}`);
  process.exit(1);
}

console.info("✅ Identical results.");
