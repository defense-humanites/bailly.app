/**
 * The morphological analyzer, as `Morpheus.lookup()` uses it: one Greek context of
 * libmorpheus, whatever the binding (today the WebAssembly module, cf. `wasm.ts`).
 *
 * The analyses are the *named* form of the libmorpheus bindings (`MorpheusAnalysis`
 * of `@libmorpheus/deno` and `@libmorpheus/node`): the API exposes a subset of them
 * (`Morphology`, cf. `../Morpheus.ts`), so their names are part of its contract.
 */

export interface AnalyzeOptions {
  /** Keep the letter case (`MORPHEUS_OPTION_STRICT_CASE`). */
  strictCase: boolean;
  /** Ignore the accents of the form (`MORPHEUS_OPTION_IGNORE_ACCENTS`). */
  ignoreAccents: boolean;
}

export interface Lemmatizer {
  /**
   * Analyzes a Beta Code form (e.g. `lo/gou`), with Morpheus' ordering and
   * duplicates. The analyses are empty for an unknown form.
   * @throws {LemmatizerError} On a failure of libmorpheus for this form (e.g. an
   *   internal error): the caller can go on with the other forms.
   */
  analyze(betaCode: string, options: AnalyzeOptions): Promise<MorpheusAnalysis[]>;
}

/** A failure of the analyzer reported by libmorpheus (status code attached). */
export class LemmatizerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LemmatizerError";
    this.status = status;
  }
}

export type MorpheusPartOfSpeechName =
  | "unknown"
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "article"
  | "pronoun"
  | "numeral"
  | "preposition"
  | "conjunction"
  | "particle"
  | "interjection";
export type MorpheusPersonName = "first" | "second" | "third";
export type MorpheusNumberName = "singular" | "dual" | "plural";
export type MorpheusGenderName = "masculine" | "feminine" | "neuter" | "adverbial";
export type MorpheusCaseName =
  | "nominative"
  | "genitive"
  | "dative"
  | "accusative"
  | "vocative"
  | "ablative";
export type MorpheusTenseName =
  | "present"
  | "imperfect"
  | "future"
  | "aorist"
  | "perfect"
  | "pluperfect"
  | "future-perfect"
  | "past-absolute";
export type MorpheusMoodName =
  | "indicative"
  | "subjunctive"
  | "optative"
  | "imperative"
  | "infinitive"
  | "participle"
  | "gerundive"
  | "supine"
  | "conditional";
export type MorpheusVoiceName =
  | "active"
  | "middle"
  | "passive"
  | "medio-passive"
  | "deponent";
export type MorpheusDegreeName = "positive" | "comparative" | "superlative";
export type MorpheusDialectName =
  | "attic"
  | "ionic"
  | "aeolic"
  | "lesbian"
  | "homeric"
  | "doric"
  | "paradigm"
  | "non-homeric-epic"
  | "epic"
  | "prose";
export type MorpheusGeographicRegionName =
  | "phocis"
  | "locris"
  | "elis"
  | "laconia"
  | "heraclea"
  | "megarid"
  | "argolid"
  | "rhodes"
  | "cos"
  | "thera"
  | "cyrene"
  | "crete"
  | "arcadia"
  | "cyprus"
  | "boeotia";
export type MorpheusTruncatedFieldName =
  | "raw"
  | "workword"
  | "lemma"
  | "preverb"
  | "augment"
  | "stem"
  | "suffix"
  | "ending"
  | "crasis"
  | "dictionaryForm"
  | "englishForm"
  | "rawPreverb"
  | "domains";

/** One analysis of a form, with named grammatical values (cf. `decode.ts`). */
export interface MorpheusAnalysis {
  readonly partOfSpeech: MorpheusPartOfSpeechName;
  readonly dialects: readonly MorpheusDialectName[];
  readonly geographicRegions: readonly MorpheusGeographicRegionName[];
  readonly person: MorpheusPersonName | null;
  readonly grammaticalNumber: MorpheusNumberName | null;
  readonly genders: readonly MorpheusGenderName[];
  readonly grammaticalCases: readonly MorpheusCaseName[];
  readonly tense: MorpheusTenseName | null;
  readonly mood: MorpheusMoodName | null;
  readonly voices: readonly MorpheusVoiceName[];
  readonly degree: MorpheusDegreeName | null;
  readonly raw: string;
  readonly workword: string;
  readonly lemma: string;
  readonly preverb: string;
  readonly augment: string;
  readonly stem: string;
  readonly suffix: string;
  readonly ending: string;
  readonly crasis: string;
  readonly dictionaryForm: string;
  readonly englishForm: string;
  readonly rawPreverb: string;
  readonly domains: string;
  /** Engine morph flags, by name (e.g. `irregular-form`, `late`). */
  readonly morphFlags: readonly string[];
  readonly truncatedFields: readonly MorpheusTruncatedFieldName[];
}
