import { DEFAULT_ENTRY_FIELDS, ENTRY_FIELDS, type EntryField } from "@bailly/api-types";
import { assert, assertEquals } from "./support/assert.ts";
import { app, morpheusAvailable } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";

/*
 * The responses as they go over the network match the contract shared with the
 * front end (`@bailly/api-types`): its types are erased at run time, hence these
 * checks of the shapes, on real responses.
 */

const isString = (value: unknown): value is string => typeof value === "string";

/** An entry with exactly the requested fields (and `children` for a group). */
function assertEntry(entry: Record<string, unknown>, fields: readonly EntryField[], extra: string[] = []) {
  for (const field of fields) assert(isString(entry[field]), `${field}: ${JSON.stringify(entry)}`);
  const allowed = new Set<string>([...fields, "children", ...extra]);
  for (const key of Object.keys(entry)) assert(allowed.has(key), `unexpected field ${key}`);
  if (entry.children !== undefined) {
    assert(Array.isArray(entry.children));
    for (const child of entry.children) assertEntry(child as Record<string, unknown>, fields);
  }
}

const get = async (path: string) => {
  const response = await app.request(path);
  assertEquals(response.status, 200, path);
  const { data } = await json(response);
  assert(isString(data.version), "version");
  return data;
};

test("Contract: the fields served are the contract's", async () => {
  const data = await get(`/entry/logos?fields=${ENTRY_FIELDS.join(",")}`);
  assertEntry(data.entry, ENTRY_FIELDS);
  const defaults = await get("/entry/logos");
  assertEntry(defaults.entry, DEFAULT_ENTRY_FIELDS);
});

test("Contract: GET /entry/:uri with its siblings", async () => {
  const data = await get("/entry/logos?fields=word,uri&siblings=true&siblingsFields=uri");
  assertEntry(data.entry, ["word", "uri"]);
  assertEntry(data.siblings.previous, ["uri"]);
  assertEntry(data.siblings.next, ["uri"]);
  assertEquals(Object.keys((await get("/entry/no-such-entry")).entry).length, 0);
});

test("Contract: GET /entry/random", async () => {
  const data = await get("/entry/random?fields=word,uri&siblings=true&lengthRange=400,700");
  assert(typeof data.length === "number");
  assertEntry(data.entry, ["word", "uri"]);
  assertEntry(data.siblings.next, ["word", "uri"]);
});

test({
  name: "Contract: GET /lookup/:q, with the morphology",
  ignore: !morpheusAvailable,
  fn: async () => {
    const data = await get("/lookup/λόγου?fields=word,uri&morphology=true");
    assert(typeof data.count === "number" && typeof data.countAll === "number");
    assert(data.entries.length > 0);
    for (const entry of data.entries) {
      assertEntry(entry, ["word", "uri"], ["isExact", "isMorpheus", "morphology"]);
      assert(typeof entry.isExact === "boolean" && typeof entry.isMorpheus === "boolean");
    }
    const analyses = data.entries.flatMap(
      (entry: { morphology?: Record<string, unknown[]> }) => Object.values(entry.morphology ?? {}).flat()
    );
    assert(analyses.length > 0);
    for (const analysis of analyses) {
      assert(isString(analysis.partOfSpeech));
      for (const list of ["dialects", "geographicRegions", "genders", "grammaticalCases", "voices", "morphFlags"]) {
        assert(Array.isArray(analysis[list]) && analysis[list].every(isString), list);
      }
      for (const nullable of ["person", "grammaticalNumber", "tense", "mood", "degree"]) {
        assert(analysis[nullable] === null || isString(analysis[nullable]), nullable);
      }
      assert(isString(analysis.preverb) && isString(analysis.augment));
    }
  }
});

test("Contract: GET /entries/excerpts", async () => {
  const data = await get("/entries/excerpts?uris=logos,oudos,no-such-entry");
  assertEquals(data.missing, ["no-such-entry"]);
  for (const entry of data.entries) {
    assertEntry(entry, ["uri", "word", "excerpt"], ["homonyms"]);
    assert(entry.homonyms === undefined || typeof entry.homonyms === "number");
  }
});
