/**
 * The dependencies of the application on Node.js (server and tests): the SQLite
 * dictionary and the WebAssembly Morpheus with its stem data read from the disk.
 */

import { existsSync } from "node:fs";
import type { AppDependencies } from "../app.ts";
import { SqliteDictionary } from "../db/sqlite.ts";
import { preloadLookupStatements } from "../model/lookup.ts";
import { Morpheus } from "../Morpheus.ts";
import { loadStemlib } from "../morpheus/stemlib.ts";
import { WasmLemmatizer } from "../morpheus/wasm.ts";
import type { Settings } from "../Settings.ts";

export async function createNodeDependencies(
  settings: Settings
): Promise<AppDependencies & { dictionary: SqliteDictionary }> {
  const dictionary = await SqliteDictionary.open(settings.dbFilePath);

  {
    const start = performance.now();
    const count = preloadLookupStatements(dictionary);
    console.info(
      `${count ? "✅" : "🟠"} Prepared ${count} lookup statements in ${
        (performance.now() - start).toFixed(1)
      } ms.`
    );
  }

  return {
    dictionary,
    morpheus: await createNodeMorpheus(settings)
  };
}

/**
 * Without the stem data, the lookups silently lose every Morpheus result. This is
 * tolerated in development (e.g. to run the API or the tests without the data), but
 * not in production, where the startup must fail instead.
 */
export async function createNodeMorpheus(settings: Settings): Promise<Morpheus> {
  const dataPath = settings.morpheusDataPath;

  if (!existsSync(dataPath)) {
    const reason = `no stem data in '${dataPath}' (run \`npm run morpheus:data\`)`;

    if (!settings.isDevEnv) {
      throw new Error(`libmorpheus is unavailable: ${reason}`);
    }

    console.warn(`⚠️ libmorpheus is disabled: ${reason}`);
    return new Morpheus();
  }

  const start = performance.now();
  const lemmatizer = await WasmLemmatizer.create({
    stemlib: () => loadStemlib(dataPath)
  });
  const elapsed = (performance.now() - start).toFixed(1);
  console.info(`✅ libmorpheus (WebAssembly) ready in ${elapsed} ms.`);

  return new Morpheus(lemmatizer);
}
