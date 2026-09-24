import { assertEquals } from "@std/assert";
import { describe } from "@std/testing/bdd";
import { app } from "../src/index.ts";

/*
 * URI resolution by `/entry` (cf. `src/model/entry.ts`): an exact URI is used as is;
 * otherwise, its normalized form (`reencode()` with `removeDiacritics`) is tried.
 *
 * Regressions covered:
 *   - the rough breathing (`h`, including in `rh`) must never be stripped: "hodos"
 *     (ὁδός) and "odos" (ὀδός) are distinct entries;
 *   - the ASCII hyphen must be preserved (contract verbs, suffixes);
 *   - malformed URIs (acute accents, macrons) are still resolved.
 */

type Expected = {
  uri: string;
  word: string;
  children?: string[];
} | null;

type EntryData = {
  entry: { uri?: string; word?: string; children?: { uri: string }[] };
};

const getEntry = async (uri: string): Promise<EntryData> => {
  const response = await app.request(
    `/entry/${encodeURIComponent(uri)}?fields=word,uri`
  );
  assertEquals(response.status, 200);
  return (await response.json()).data;
};

// Databases generated before the NFC normalization of the data converter keep
// the Bailly's oxia (e.g. U+1F79) rather than the tonos (U+03CC): compare the
// words in NFC.
const nfc = (expected: Expected): Expected =>
  expected && { ...expected, word: expected.word.normalize("NFC") };

const simplify = ({ entry }: EntryData): Expected =>
  entry.uri
    ? {
      uri: entry.uri,
      word: (entry.word ?? "").normalize("NFC"),
      ...(entry.children ? { children: entry.children.map((child) => child.uri) } : {})
    }
    : null;

const runCases = (cases: [string, Expected][]) => {
  for (const [uri, expected] of cases) {
    Deno.test(`GET /entry/${uri}`, async () => {
      assertEquals(simplify(await getEntry(uri)), nfc(expected));
    });
  }
};

describe("GET /entry: exact URIs", () => {
  runCases([
    // Rough breathing.
    ["homoios", { uri: "homoios", word: "ὅμοιος" }],
    ["hodos", { uri: "hodos", word: "ὁδός" }],
    ["odos", { uri: "odos", word: "ὀδός" }],
    ["hê_(1)", { uri: "hê_(1)", word: "ἡ" }],
    ["ê_(1)", {
      uri: "ê_(1)",
      word: "ἤ",
      children: ["ê_(1)#1", "ê_(1)#2"]
    }],
    // `rh`.
    ["rhêtôr", { uri: "rhêtôr", word: "ῥήτωρ" }],
    ["homoiorrhusmos", { uri: "homoiorrhusmos", word: "ὁμοιόρρυσμος" }],
    // Hyphens.
    ["agapaô-ô", { uri: "agapaô-ô", word: "ἀγαπάω-ῶ" }],
    ["homoiokatalêkteô-ô", {
      uri: "homoiokatalêkteô-ô",
      word: "ὁμοιοκαταληκτέω-ῶ"
    }],
    ["-de", { uri: "-de", word: "-δε" }],
    ["-phi(n)", { uri: "-phi(n)", word: "-φι(ν)" }],
    // Grouped entries (`#n` suffix).
    ["oudos", {
      uri: "oudos",
      word: "οὐδός",
      children: ["oudos#1", "oudos#2"]
    }],
    ["oudos#1", {
      uri: "oudos",
      word: "οὐδός",
      children: ["oudos#1", "oudos#2"]
    }]
  ]);
});

describe("GET /entry: malformed URIs", () => {
  runCases([
    // Acute accents.
    ["lógos", { uri: "logos", word: "λόγος" }],
    ["hódos", { uri: "hodos", word: "ὁδός" }],
    ["hómoios", { uri: "homoios", word: "ὅμοιος" }],
    // Macrons.
    ["hēmera", {
      uri: "hêmera",
      word: "ἡμέρα",
      children: ["hêmera#1", "hêmera#2"]
    }],
    ["hḗmera", {
      uri: "hêmera",
      word: "ἡμέρα",
      children: ["hêmera#1", "hêmera#2"]
    }],
    ["rhḗtōr", { uri: "rhêtôr", word: "ῥήτωρ" }],
    // Typographic hyphen (U+2010).
    ["agapaô‐ô", { uri: "agapaô-ô", word: "ἀγαπάω-ῶ" }]
  ]);
});

describe("GET /entry: no false matches", () => {
  runCases([
    // The normalization must not add nor remove any rough breathing.
    ["omoios", null],
    ["hhomoios", null]
  ]);
});

describe("POST /entry (batch)", () => {
  Deno.test("POST /entry: homoios,agapaô-ô,hódos", async () => {
    const response = await app.request("/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "homoios,agapaô-ô,hódos", fields: ["uri"] })
    });
    assertEquals(response.status, 200);

    const json = await response.json();
    assertEquals(
      json.queries.map((query: { data: EntryData }) => query.data.entry.uri),
      ["homoios", "agapaô-ô", "hodos"]
    );
  });
});
