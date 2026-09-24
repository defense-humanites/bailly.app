import {
  type MorpheusContext,
  MorpheusLanguage,
  MorpheusLibrary,
  MorpheusOption
} from "@libmorpheus/deno";
import { convert } from "@humanities/greek-conversion";
import type { ApiLookupParams } from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { graveToAcute } from "./helpers.ts";
import { Settings } from "./Settings.ts";

// `export type { … } from` doesn't bring the type into this module's scope.
import type { MorpheusAnalysis } from "@libmorpheus/deno";
export type { MorpheusAnalysis };

type MorpheusLookupOptions = Pick<
  ApiLookupParams<never>,
  "caseSensitive" | "diacriticSensitive"
>;

/** Morphological data exposed by the API (a subset of a Morpheus analysis). */
export type Morphology = Pick<
  MorpheusAnalysis,
  | "partOfSpeech"
  | "dialects"
  | "geographicRegions"
  | "person"
  | "grammaticalNumber"
  | "genders"
  | "grammaticalCases"
  | "tense"
  | "mood"
  | "voices"
  | "degree"
  | "preverb"
  | "augment"
  | "morphFlags"
>;

/**
 * Analyses grouped by key (e.g. "lemma|stem"). `T` is a full Morpheus analysis by
 * default, or the morphological data exposed by the API (`Morphology`).
 */
export type MorpheusResponse<T = MorpheusAnalysis> = Record<string, T[]>;

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
        contexts.push(
          library.createContext(
            settings.morpheusStemlibPath,
            MorpheusLanguage.Greek
          )
        );
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
  ): Promise<MorpheusResponse> {
    const settings = Settings.getSettings();

    if (!this.#isNeeded(greekStr)) {
      if (settings.isDevEnv) {
        console.log(`Invalid Morpheus input '${greekStr}'.`);
      }
      return {};
    }

    const {
      caseSensitive = false,
      diacriticSensitive = false
    } = options;

    console.log(
      "caseSensitive",
      caseSensitive,
      ", diacriticSensitive",
      diacriticSensitive
    );

    let morpheusOptions = 0n;
    if (caseSensitive) morpheusOptions |= MorpheusOption.StrictCase;
    if (!diacriticSensitive) morpheusOptions |= MorpheusOption.IgnoreAccents;

    // Morpheus does not recognize contextual grave accents. They are always
    // converted to their lexical acute equivalent for analysis; the original
    // Greek surface form is preserved in the public morphology key.
    const betaCode = convert(
      graveToAcute(greekStr),
      "greek",
      "beta-code",
      { preset: "perseus" }
    );

    console.log(greekStr, betaCode);

    try {
      const analyses = await this.#context().analyze(betaCode, morpheusOptions);
      console.log(analyses.map((analysis) => analysis.lemma));
      return this.#formatMorpheusResponse(analyses, greekStr);
    } catch (error) {
      console.error("libmorpheus call failed:", error);
      return {};
    }
  }

  #analysisKey(analysis: MorpheusAnalysis): string {
    return JSON.stringify({
      lemma: analysis.lemma.replace(/^\*/, ""),
      partOfSpeech: analysis.partOfSpeech,
      genders: analysis.genders.toSorted(),
      grammaticalCases: analysis.grammaticalCases.toSorted(),
      grammaticalNumber: analysis.grammaticalNumber,
      tense: analysis.tense,
      mood: analysis.mood,
      voices: analysis.voices.toSorted(),
      person: analysis.person,
      degree: analysis.degree,
      dialects: analysis.dialects.toSorted(),
      geographicRegions: analysis.geographicRegions.toSorted(),
      morphFlags: analysis.morphFlags.toSorted()
    });
  }

  #formatMorpheusResponse(
    analyses: readonly MorpheusAnalysis[],
    surfaceForm: string
  ): MorpheusResponse {
    const unique = new Map<string, MorpheusAnalysis>();

    for (const analysis of analyses) {
      unique.set(this.#analysisKey(analysis), analysis);
    }

    const grouped = Object.groupBy(
      [...unique.values()].filter((analysis) => analysis.lemma),
      (analysis) => analysis.lemma
    );

    return Object.fromEntries(
      Object.entries(grouped).map(([lemma, values]) => {
        const greekLemma = convert(
          lemma.replace(/\d+$/, ""),
          "beta-code",
          "greek"
        );

        return [`${greekLemma}|${surfaceForm}`, values ?? []];
      })
    );
  }
}
