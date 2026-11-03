/**
 * Decoding of the numeric codes of the libmorpheus C ABI (version 2) into the named
 * values of its Deno and Node.js bindings.
 *
 * The WebAssembly binding (`@libmorpheus/wasm`) returns the raw codes of the C
 * structures (`MorpheusRawAnalysis`); the tables and rules below are those of
 * `@libmorpheus/node` (`semanticAnalysis()`, `bindings/js/node/index.js`) and of
 * `@libmorpheus/deno`, verified identical, so that the API exposes the same
 * morphology whatever the binding. Derived from libmorpheus (AGPL-3.0-or-later,
 * © 2026 Antoine Boquet).
 */

import type { MorpheusRawAnalysis } from "@libmorpheus/wasm";
import type {
  MorpheusAnalysis,
  MorpheusCaseName,
  MorpheusDegreeName,
  MorpheusDialectName,
  MorpheusGenderName,
  MorpheusGeographicRegionName,
  MorpheusMoodName,
  MorpheusNumberName,
  MorpheusPartOfSpeechName,
  MorpheusPersonName,
  MorpheusTenseName,
  MorpheusTruncatedFieldName,
  MorpheusVoiceName
} from "./lemmatizer.ts";

type Named<T extends string> = readonly (readonly [number, T])[];

const PART_OF_SPEECH_NAMES: Named<MorpheusPartOfSpeechName> = [
  [0, "unknown"],
  [1, "noun"],
  [2, "verb"],
  [3, "adjective"],
  [4, "adverb"],
  [5, "article"],
  [6, "pronoun"],
  [7, "numeral"],
  [8, "preposition"],
  [9, "conjunction"],
  [10, "particle"],
  [11, "interjection"]
];
const PERSON_NAMES: Named<MorpheusPersonName> = [
  [1, "first"],
  [2, "second"],
  [3, "third"]
];
const NUMBER_NAMES: Named<MorpheusNumberName> = [
  [1, "singular"],
  [2, "dual"],
  [3, "plural"]
];
const GENDER_NAMES: Named<MorpheusGenderName> = [
  [1, "adverbial"],
  [2, "feminine"],
  [4, "masculine"],
  [8, "neuter"]
];
const CASE_NAMES: Named<MorpheusCaseName> = [
  [1, "ablative"],
  [2, "accusative"],
  [4, "dative"],
  [8, "genitive"],
  [16, "nominative"],
  [32, "vocative"]
];
const TENSE_NAMES: Named<MorpheusTenseName> = [
  [1, "present"],
  [2, "imperfect"],
  [3, "future"],
  [4, "aorist"],
  [5, "perfect"],
  [6, "pluperfect"],
  [7, "future-perfect"],
  [8, "past-absolute"]
];
const MOOD_NAMES: Named<MorpheusMoodName> = [
  [1, "conditional"],
  [2, "gerundive"],
  [3, "imperative"],
  [4, "indicative"],
  [5, "infinitive"],
  [6, "optative"],
  [7, "participle"],
  [8, "subjunctive"],
  [9, "supine"]
];
const VOICE_NAMES: Named<MorpheusVoiceName> = [
  [1, "active"],
  [2, "passive"],
  [4, "middle"]
];
const VOICE_EXACT_NAMES: Named<MorpheusVoiceName> = [
  [6, "medio-passive"],
  [5, "deponent"]
];
const DEGREE_NAMES: Named<MorpheusDegreeName> = [
  [1, "positive"],
  [2, "comparative"],
  [3, "superlative"]
];
const DIALECT_NAMES: Named<MorpheusDialectName> = [
  [1, "aeolic"],
  [2, "attic"],
  [4, "doric"],
  [8, "homeric"],
  [16, "ionic"],
  [32, "lesbian"],
  [64, "non-homeric-epic"],
  [128, "paradigm"],
  [256, "prose"]
];
/** Homeric + non-Homeric epic. */
const DIALECT_EPIC = 72;
const DIALECT_NAME_ORDER: readonly MorpheusDialectName[] = [
  "attic",
  "ionic",
  "aeolic",
  "lesbian",
  "homeric",
  "doric",
  "paradigm",
  "non-homeric-epic",
  "epic",
  "prose"
];
const REGION_NAMES: Named<MorpheusGeographicRegionName> = [
  [1, "arcadia"],
  [2, "argolid"],
  [4, "boeotia"],
  [8, "cos"],
  [16, "crete"],
  [32, "cyprus"],
  [64, "cyrene"],
  [128, "elis"],
  [256, "heraclea"],
  [512, "laconia"],
  [1024, "locris"],
  [2048, "megarid"],
  [4096, "phocis"],
  [8192, "rhodes"],
  [16384, "thera"]
];
const TRUNCATED_FIELD_NAMES: Named<MorpheusTruncatedFieldName> = [
  [1 << 0, "raw"],
  [1 << 1, "workword"],
  [1 << 2, "lemma"],
  [1 << 3, "preverb"],
  [1 << 4, "augment"],
  [1 << 5, "stem"],
  [1 << 6, "suffix"],
  [1 << 7, "ending"],
  [1 << 8, "crasis"],
  [1 << 9, "dictionaryForm"],
  [1 << 10, "englishForm"],
  [1 << 11, "rawPreverb"],
  [1 << 12, "domains"]
];

/** The 84 engine morph flags, by bit index (the order of the bindings' listing). */
const MORPH_FLAG_NAMES: Named<string> = [
  [74, "syllabic-augment"],
  [7, "compound-only"],
  [19, "enclitic"],
  [35, "iterative"],
  [73, "suffix-accent"],
  [72, "stem-accent"],
  [8, "contracted"],
  [52, "person-name"],
  [3, "antepenult-accent"],
  [34, "irregular-superlative"],
  [32, "irregular-comparative"],
  [47, "no-comparison"],
  [69, "short-penult"],
  [38, "long-penult"],
  [64, "recessive-accent"],
  [0, "accent-optional"],
  [43, "needs-accent"],
  [66, "rho-eta-iota-alpha"],
  [45, "not-in-composition"],
  [26, "has-preverb"],
  [79, "unaugmented"],
  [13, "dissimilation"],
  [56, "proclitic"],
  [4, "apocope"],
  [33, "irregular-form"],
  [25, "has-augment"],
  [60, "quantity-metathesis"],
  [49, "nu-movable"],
  [29, "intervocalic-s-to-h"],
  [55, "preverb-augment"],
  [53, "poetic"],
  [81, "uncontracted-stem"],
  [40, "metathesis"],
  [18, "elided-preverb"],
  [28, "indeclinable-form"],
  [67, "root-preverb"],
  [12, "diminutive"],
  [36, "late"],
  [61, "rare"],
  [62, "raw-preverb"],
  [17, "early"],
  [70, "short-subjunctive"],
  [78, "unaspirated-preverb"],
  [65, "reduplication"],
  [80, "uncontracted-ending"],
  [10, "derivative"],
  [5, "attic-reduplication"],
  [48, "no-reduplication"],
  [50, "n-infix"],
  [75, "syncope"],
  [27, "impersonal"],
  [44, "needs-rough-breathing"],
  [46, "no-circumflex"],
  [6, "causal"],
  [30, "intransitive"],
  [77, "tmesis"],
  [63, "raw-sonant"],
  [57, "prodelision"],
  [22, "frequentative"],
  [37, "later"],
  [15, "double-augment"],
  [16, "double-reduplication"],
  [11, "desiderative"],
  [54, "present-reduplication"],
  [20, "ends-in-digamma"],
  [23, "geographic-name"],
  [14, "doubled-consonant"],
  [31, "iota-intensive"],
  [39, "lost-accent"],
  [71, "sigma-to-ci"],
  [68, "short-eis"],
  [58, "pros-to-poti"],
  [41, "meta-to-peda"],
  [59, "pros-to-proti"],
  [83, "upo-to-upai"],
  [51, "para-to-parai"],
  [82, "uper-to-upeir"],
  [21, "en-to-eni"],
  [2, "alpha-privative"],
  [1, "alpha-copulative"],
  [42, "metrically-long"],
  [9, "delta-preverb"],
  [76, "tau-preverb"],
  [24, "group-name"]
];

function exactName<T extends string>(value: number, entries: Named<T>): T | null {
  return entries.find(([code]) => code === value)?.[1] ?? null;
}

function maskNames<T extends string>(
  value: number,
  entries: Named<T>,
  exactEntries: Named<T> = []
): T[] {
  const exact = exactName(value, exactEntries);
  if (exact !== null) return [exact];
  return entries.filter(([bit]) => (value & bit) === bit).map(([, name]) => name);
}

function dialectNames(value: number): MorpheusDialectName[] {
  let remaining = value;
  const selected = new Set<MorpheusDialectName>();

  if ((remaining & DIALECT_EPIC) === DIALECT_EPIC) {
    selected.add("epic");
    remaining &= ~DIALECT_EPIC;
  }
  for (const [bit, name] of DIALECT_NAMES) {
    if ((remaining & bit) === bit) selected.add(name);
  }

  return DIALECT_NAME_ORDER.filter((name) => selected.has(name));
}

function hasMorphFlag(bits: Uint8Array, flag: number): boolean {
  const index = Math.floor(flag / 8);
  return index < bits.length && (bits[index]! & (1 << (flag % 8))) !== 0;
}

/** The named form of a raw analysis of the WebAssembly binding. */
export function decodeAnalysis(raw: MorpheusRawAnalysis): MorpheusAnalysis {
  const morphFlags: string[] = [];

  for (const [code, name] of MORPH_FLAG_NAMES) {
    if (hasMorphFlag(raw.morphFlags, code)) morphFlags.push(name);
  }

  return {
    partOfSpeech: exactName(raw.partOfSpeech, PART_OF_SPEECH_NAMES) ?? "unknown",
    dialects: dialectNames(raw.dialect),
    geographicRegions: maskNames(raw.geographicRegion, REGION_NAMES),
    person: exactName(raw.person, PERSON_NAMES),
    grammaticalNumber: exactName(raw.number, NUMBER_NAMES),
    genders: maskNames(raw.gender, GENDER_NAMES),
    grammaticalCases: maskNames(raw.grammaticalCase, CASE_NAMES),
    tense: exactName(raw.tense, TENSE_NAMES),
    mood: exactName(raw.mood, MOOD_NAMES),
    voices: maskNames(raw.voice, VOICE_NAMES, VOICE_EXACT_NAMES),
    degree: exactName(raw.degree, DEGREE_NAMES),
    raw: raw.raw,
    workword: raw.workword,
    lemma: raw.lemma,
    preverb: raw.preverb,
    augment: raw.augment,
    stem: raw.stem,
    suffix: raw.suffix,
    ending: raw.ending,
    crasis: raw.crasis,
    dictionaryForm: raw.dictionaryForm,
    englishForm: raw.englishForm,
    rawPreverb: raw.rawPreverb,
    domains: raw.domains,
    morphFlags,
    truncatedFields: maskNames(raw.truncatedFields, TRUNCATED_FIELD_NAMES)
  };
}
