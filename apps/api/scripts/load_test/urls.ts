/**
 * Draws the requests of the load test (`scripts/load_test/k6.js`) from the database:
 * the front end's own requests (cf. `bailly-app-nuxt`), in the proportions of a visit.
 *
 *   - `lookup`: the search as you type, letter by letter, of dictionary words (with
 *     Morpheus, as by default), and inflected forms (Morpheus resolves the lemma);
 *   - `entry`: an entry page (definition and neighbors);
 *   - `random`: the random entry of the home page;
 *   - `excerpts`: a batch of bookmark excerpts (synchronization).
 *
 * The same paths go to both APIs (Heroku and the Worker). Written to
 * `database/load-urls.json` (dictionary data: ignored by git).
 *
 * Usage: node scripts/load_test/urls.ts [number of words]
 */

import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { DATABASE } from "../../src/defaults.ts";

const wordCount = Number(process.argv[2] ?? 300);
const OUTPUT = "database/load-urls.json";

const db = new DatabaseSync(`file:${DATABASE.filePath}?immutable=1`, { readOnly: true });

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

const LOOKUP = query({
  limit: "30",
  fields: "word,uri,excerpt",
  inputMode: "greek",
  diacriticSensitive: "false",
  skipMorpheus: "false"
});

const ENTRY = query({
  fields: "word,uri,excerpt,htmlDefinition",
  siblings: "true",
  siblingsFields: "word,uri,excerpt"
});

const RANDOM = query({
  fields: "word,uri,excerpt,htmlDefinition",
  lengthRange: "400,700",
  siblings: "true",
  siblingsFields: "word,uri,excerpt"
});

// Words people look up: those with a definition of some length (the common ones),
// drawn at random, as typed (no diacritics, final sigma).
const words = (db.prepare(
  `SELECT searchableAtonicCaseInsensitive AS key, uri FROM bailly
   WHERE length(definition) > 1500 AND uri NOT LIKE '%#%'
   ORDER BY random() LIMIT ?1`
).all(wordCount) as { key: string; uri: string }[]);

const lookups: string[] = [];
for (const { key } of words) {
  const letters = [...key.replace(/σ$/, "ς")];
  for (let length = 1; length <= Math.min(letters.length, 8); length++) {
    lookups.push(`/lookup/${encodeURIComponent(letters.slice(0, length).join(""))}?${LOOKUP}`);
  }
}

// Inflected forms, whole (Morpheus).
const FORMS = [
  "λόγου", "λόγοις", "ἀνθρώπων", "ἔλυσα", "ἐποίησε", "εἶπον", "ἦλθον", "ἔχει",
  "γενέσθαι", "ἐστί", "ἦν", "ὄντα", "πόλεως", "βασιλέως", "ἄνδρες", "γυναικός",
  "θεῶν", "ἐλθών", "ἰδεῖν", "λέγουσι", "πράγματα", "χρόνου", "ἡμέρας", "ψυχῆς",
  "σώματος", "φύσει", "ἀρετῆς", "δίκης", "νόμους", "ἔπεσθαι"
];
for (const form of FORMS) lookups.push(`/lookup/${encodeURIComponent(form)}?${LOOKUP}`);

const entries = (db.prepare(
  "SELECT uri FROM bailly WHERE uri NOT LIKE '%#%' ORDER BY random() LIMIT ?1"
).all(wordCount * 2) as { uri: string }[])
  .map(({ uri }) => `/entry/${encodeURIComponent(uri)}?${ENTRY}`);

const excerpts = Array.from({ length: 20 }, () =>
  (db.prepare("SELECT uri FROM bailly ORDER BY random() LIMIT 50").all() as {
    uri: string;
  }[]).map(({ uri }) => uri))
  .map((uris) => `/entries/excerpts?${query({ uris: uris.join(",") })}`);

writeFileSync(
  OUTPUT,
  JSON.stringify({ lookup: lookups, entry: entries, random: [`/entry/random?${RANDOM}`], excerpts })
);

console.info(
  `✅ ${OUTPUT}: ${lookups.length} lookups, ${entries.length} entries, ` +
    `${excerpts.length} excerpt batches.`
);
