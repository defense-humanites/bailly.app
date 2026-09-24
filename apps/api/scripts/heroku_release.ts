/**
 * Heroku release phase (cf. `Procfile`): checks that libmorpheus loads and analyzes a
 * form before the new release is deployed. On failure, Heroku keeps the current
 * release running.
 *
 * This guards against a failed `heroku_build.ts` (whose exit code the buildpack
 * ignores) and against missing or wrong MORPHEUS_* config vars.
 */

import { toSearchKey } from "@humanities/bailly-search-key";
import { Morpheus } from "../src/Morpheus.ts";

try {
  // Throws in production when libmorpheus is unavailable.
  const morpheus = await Morpheus.getMorpheus();
  const analyses = await morpheus.lookup("λόγου", {
    caseSensitive: false,
    diacriticSensitive: false
  });

  // Keys are "lemma|surface form".
  const lemmas = Object.keys(analyses).map((key) => toSearchKey(key.split("|")[0]));

  if (!lemmas.includes("λογοσ")) {
    throw new Error(
      `unexpected analysis of 'λόγου': ${JSON.stringify(Object.keys(analyses))}`
    );
  }

  console.info("✅ libmorpheus is available.");
  Deno.exit(0);
} catch (error) {
  console.error("❌ Release check failed:", error);
  Deno.exit(1);
}
