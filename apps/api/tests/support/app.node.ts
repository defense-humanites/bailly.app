/**
 * The application under test on Node.js (`#test-app` of the `node` Vitest project):
 * the SQLite dictionary and the WebAssembly Morpheus with the stem data of
 * `morpheus-data/` (the Morpheus tests are skipped without it).
 *
 * Development settings: no batch nor row limit, diagnostics on.
 */

import { createApp } from "../../src/app.ts";
import { createNodeDependencies } from "../../src/node/dependencies.ts";
import { Settings } from "../../src/Settings.ts";
import { TEST_ENVIRONMENT } from "./environment.ts";

const settings = Settings.configure(TEST_ENVIRONMENT);
const dependencies = await createNodeDependencies(settings);

export const dictionary = dependencies.dictionary;
export const morpheusAvailable = dependencies.morpheus.isAvailable;
export const app = createApp(dependencies);
