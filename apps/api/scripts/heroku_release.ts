/**
 * Heroku release phase (cf. `Procfile`): checks, before the new release is deployed,
 * that the database opens and that libmorpheus analyzes a form. On failure, Heroku
 * keeps the current release running.
 *
 * This guards against a missing database revision, a failed `heroku_build.ts` (whose
 * exit code the buildpack ignores) and wrong environment overrides.
 */

import { toSearchKey } from "@humanities/bailly-search-key";
import { Database } from "../src/Database.ts";
import { Morpheus } from "../src/Morpheus.ts";

try {
  // Throws if the database file (or its `.gz` archive) is missing.
  const db = await Database.getConnection();
  const [rows] = db.prepare("SELECT COUNT(*) FROM bailly").value<[number]>() ?? [0];
  if (!rows) throw new Error("the database is empty");
  console.info(`✅ Database: ${rows} rows.`);

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
