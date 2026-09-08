import {
  type MorpheusAnalysis as LibMorpheusAnalysis,
  type MorpheusContext,
  MorpheusLanguage,
  MorpheusLibrary,
  MorpheusOption
} from "@libmorpheus/deno";

import { convert } from "@humanities/greek-conversion";
import type { ApiLookupParams } from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { Settings } from "./Settings.ts";

export interface Morphology {
  partOfSpeech?:
    | "verb"
    | "participle"
    | "adverb"
    | "adjective"
    | "nominal";
  gender?: ("masculine" | "feminine" | "neuter")[];
  case?: ("nominative" | "genitive" | "dative" | "accusative" | "vocative")[];
  number?: "singular" | "dual" | "plural";
  tense?:
    | "present"
    | "imperfect"
    | "future"
    | "aorist"
    | "perfect"
    | "pluperfect"
    | "future perfect";
  mood?:
    | "indicative"
    | "subjunctive"
    | "optative"
    | "imperative"
    | "infinitive"
    | "participle";
  voice?: "active" | "middle" | "passive" | "middle-passive";
  person?: "first" | "second" | "third";
  degree?: "comparative" | "superlative";
  dialects?: ("attic" | "ionic" | "doric" | "aeolic" | "epic")[];
  features?: string[];
}

export interface MorpheusAnalysis {
  raw?: string;
  workWord?: string;
  lemma?: string;
  prefix?: string;
  augment?: string;
  stem?: string;
  suffix?: string;
  ending?: { value: string };
  morphology?: Morphology;
}

type MorpheusLookupOptions = Pick<
  ApiLookupParams<never>,
  "caseSensitive" | "diacriticSensitive"
>;

export type MorpheusResponse<K extends MorpheusAnalysis | Morphology> = Record<
  string,
  K[]
>;

export class Morpheus {
  static #wrapper: Morpheus;

  readonly #library?: MorpheusLibrary;
  readonly #contexts: MorpheusContext[] = [];
  #nextContext = 0;

  readonly isAvailable: boolean;

  private constructor(
    library?: MorpheusLibrary,
    contexts: MorpheusContext[] = []
  ) {
    this.#library = library;
    this.#contexts = contexts;
    this.isAvailable = Boolean(library && contexts.length);
  }

  static async #init(): Promise<Morpheus> {
    const settings = Settings.getSettings();

    if (!settings.morpheusLibraryPath || !settings.morpheusStemlibPath) {
      console.warn(
        "⚠️ libmorpheus-deno is disabled: MORPHEUS_LIBRARY_PATH and " +
          "MORPHEUS_STEMLIB_PATH must both be set."
      );
      return new Morpheus();
    }

    let library: MorpheusLibrary | undefined;
    const contexts: MorpheusContext[] = [];
    try {
      library = new MorpheusLibrary(settings.morpheusLibraryPath);
      for (let index = 0; index < settings.morpheusPoolSize; index++) {
        contexts.push(library.createContext(
          settings.morpheusStemlibPath,
          MorpheusLanguage.Greek
        ));
      }
      return new Morpheus(library, contexts);
    } catch (error) {
      try {
        await Promise.all(contexts.map((context) => context.close()));
        library?.close();
      } catch {
        // Keep initialization failure non-fatal for the API.
      }
      console.error(`Failed to initialize libmorpheus: ${error}`);
      return new Morpheus();
    }
  }

  static async getMorpheus(): Promise<Morpheus> {
    if (!this.#wrapper) this.#wrapper = await Morpheus.#init();
    return this.#wrapper;
  }

  #context(): MorpheusContext {
    const context = this.#contexts[this.#nextContext];
    this.#nextContext = (this.#nextContext + 1) % this.#contexts.length;
    return context;
  }

  #isNeeded(str: string): boolean {
    return (
      this.isAvailable &&
      !/\s/.test(str) &&
      !str.toLowerCase().includes("ϝ") &&
      !str.startsWith('"') &&
      !str.startsWith(SpecialChar.explicitStart) &&
      !str.endsWith('"') &&
      !str.endsWith(SpecialChar.explicitEnd) &&
      !str.includes(SpecialChar.singleWildcard) &&
      !str.includes(SpecialChar.wildcard)
    );
  }

  async lookup(
    greekStr: string,
    options: MorpheusLookupOptions
  ): Promise<MorpheusResponse<MorpheusAnalysis>> {
    const settings = Settings.getSettings();
    if (!this.#isNeeded(greekStr)) {
      if (settings.isDevEnv) {
        console.log("greekStr:", greekStr);
        console.log(`Invalid Morpheus input '${greekStr}'.`);
      }
      return {};
    }

    const { caseSensitive = false, diacriticSensitive = false } = options;
    const betaCode = convert(greekStr, "greek", "beta-code", { preset: "perseus" });
    let morpheusOptions = 0n;
    if (caseSensitive) morpheusOptions |= MorpheusOption.StrictCase;
    if (!diacriticSensitive) morpheusOptions |= MorpheusOption.IgnoreAccents;

    try {
      const analyses = await this.#context().analyze(betaCode, morpheusOptions);
      return this.#formatMorpheusResponse(
        analyses.map((analysis) => this.#adaptAnalysis(analysis))
      );
    } catch (error) {
      console.error("libmorpheus call failed:", error);
      return {};
    }
  }

  #adaptAnalysis(analysis: LibMorpheusAnalysis): MorpheusAnalysis {
    const morphology: Morphology = {
      partOfSpeech: analysis.mood ?? undefined,
      gender: analysis.genders ?? [],
      case: analysis.grammaticalCases ?? [],
      number: analysis.grammaticalNumber ?? undefined,
      tense: analysis.tense ?? undefined,
      mood: analysis.mood ?? undefined,
      voice: analysis.voices,
      person: analysis.person ?? undefined,
      degree: analysis.degree ?? undefined,
      dialects: analysis.dialects ?? [],
      features: [...analysis.morphFlags] ?? []
    };

    return {
      raw: analysis.raw || undefined,
      workWord: analysis.workword || undefined,
      lemma: analysis.lemma || undefined,
      prefix: analysis.preverb || undefined,
      augment: analysis.augment || undefined,
      stem: analysis.stem || undefined,
      suffix: analysis.suffix || undefined,
      ending: analysis.ending ? { value: analysis.ending } : undefined,
      morphology
    };
  }

  #analysisKey(analysis: MorpheusAnalysis): string {
    const m = analysis.morphology;
    return JSON.stringify({
      lemma: analysis.lemma?.replace(/^\*/, ""),
      partOfSpeech: m?.partOfSpeech,
      gender: m?.gender?.toSorted(),
      case: m?.case?.toSorted(),
      number: m?.number,
      tense: m?.tense,
      mood: m?.mood,
      voice: m?.voice,
      person: m?.person,
      degree: m?.degree,
      dialects: m?.dialects?.toSorted(),
      features: m?.features?.toSorted()
    });
  }

  #formatMorpheusResponse(
    analyses: MorpheusAnalysis[]
  ): MorpheusResponse<MorpheusAnalysis> {
    const unique = new Map<string, MorpheusAnalysis>();
    for (const analysis of analyses) unique.set(this.#analysisKey(analysis), analysis);

    const grouped = Object.groupBy(
      [...unique.values()].filter(({ lemma, workWord }) => lemma && workWord),
      ({ lemma, workWord }) => `${lemma}@${workWord}`
    );

    return Object.fromEntries(
      Object.entries(grouped).map(([key, values]) => {
        let [lemma, workWord] = key.split("@");
        if (lemma === "tis") lemma = "ti\\s";
        lemma = lemma.replace(/\d+$/, "");
        if (
          values?.some(({ morphology }) =>
            morphology?.features?.includes("contracted")
          ) && lemma.endsWith("w")
        ) lemma = `${lemma}-w=`;

        const greekLemma = convert(lemma, "beta-code", "greek");
        const greekWorkWord = convert(workWord, "beta-code", "greek");

        return [[greekLemma, greekWorkWord].join("|"), values ?? []];
      })
    );
  }
}
