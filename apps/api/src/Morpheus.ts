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

/**
 * The two words of a crasis, in Greek (e.g. κἀγώ: `{ first: "καί", second: "ἐγώ" }`;
 * ὦγαθε: `{ first: "ὦ", second: "ἀγαθέ" }`). `second` is the form analyzed by
 * Morpheus, whose lemma is the key of the analysis.
 */
export type Crasis = {
  first: string;
  second: string;
};

/** Morphological data exposed by the API (a subset of a Morpheus analysis). */
export type Morphology =
  & Pick<
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
  >
  & {
    /** Only for a crasis reading. */
    crasis?: Crasis;
  };

/**
 * Analyses grouped by key (e.g. "lemma|stem"). `T` is a full Morpheus analysis by
 * default, or the morphological data exposed by the API (`Morphology`).
 */
export type MorpheusResponse<T = MorpheusAnalysis> = Record<string, T[]>;

const SMOOTH_BREATHING = "\u0313";
const ROUGH_BREATHING = "\u0314";
const DIAERESIS = "\u0308";

/**
 * Returns the variants of a Greek word with a smooth and a rough breathing on its
 * initial vowel (or diphthong), or a rough breathing on its initial rho. Any breathing
 * already present is replaced. Words without an initial vowel or rho are returned as is.
 */
export function buildBreathingVariants(word: string): string[] {
  const clusters = word
    .normalize("NFD")
    .replace(/[\u0313\u0314]/g, "")
    .match(/\p{L}\p{M}*|[^\p{L}]+/gu) ?? [];

  const [first = "", second = ""] = clusters;
  const firstLetter = first.charAt(0).toLowerCase();
  const secondLetter = second.charAt(0).toLowerCase();

  const withBreathing = (breathing: string): string => {
    // In a diphthong, the breathing goes on the second vowel (e.g. οὗ, αὐτός).
    const isDiphthong = /^[αεοηυ]$/.test(firstLetter) &&
      (secondLetter === "ι" || (secondLetter === "υ" && firstLetter !== "υ")) &&
      first.length === 1 &&
      !second.includes(DIAERESIS);
    const index = isDiphthong ? 1 : 0;

    return clusters
      .map((cluster, i) =>
        i === index ? cluster[0] + breathing + cluster.slice(1) : cluster
      )
      .join("")
      .normalize("NFC");
  };

  if (firstLetter === "ρ") return [withBreathing(ROUGH_BREATHING)];
  if (/^[αεηιουω]$/.test(firstLetter)) {
    return [withBreathing(SMOOTH_BREATHING), withBreathing(ROUGH_BREATHING)];
  }
  return [word];
}

/**
 * Converts a Beta Code word of Morpheus to Greek, without its quantity marks, in NFC
 * (as the dictionary data): `convert()` gives the acute as an oxia (e.g. U+1F73),
 * which NFC turns into a tonos (U+03AD).
 */
function betaCodeToGreek(betaCode: string): string {
  return convert(betaCode.replace(/[_^]/g, ""), "beta-code", "greek").normalize("NFC");
}

/** The two words of a crasis reading, in Greek; `undefined` for another reading. */
export function getCrasis(
  { crasis, workword }: Pick<MorpheusAnalysis, "crasis" | "workword">
): Crasis | undefined {
  if (!crasis) return undefined;

  return {
    first: betaCodeToGreek(crasis),
    second: betaCodeToGreek(workword)
  };
}

/**
 * Whether a Greek word has a rough breathing on its initial vowel, or on the second
 * vowel of an initial diphthong (e.g. ἁνα, οὑμός, Ἁ…).
 */
export function hasInitialRoughBreathing(word: string): boolean {
  const [first = "", second = ""] = word.normalize("NFD")
    .match(/\p{L}\p{M}*/gu) ?? [];
  return first.includes(ROUGH_BREATHING) || second.includes(ROUGH_BREATHING);
}

/**
 * Capitalizes the first letter of a Greek word, keeping its diacritics on it (a plain
 * `toUpperCase()` would turn an iota subscript into a capital iota: ᾧ → ὯΙ).
 */
/** Removes the accents and iota subscripts (breathings and diaereses are kept). */
export function removeAccents(word: string): string {
  return word.normalize("NFD").replace(/[\u0300\u0301\u0342\u0345]/g, "")
    .normalize("NFC");
}

export function capitalize(word: string): string {
  const nfd = word.normalize("NFD");
  return (nfd.charAt(0).toUpperCase() + nfd.slice(1)).normalize("NFC");
}

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
      return Morpheus.#unavailable(
        "MORPHEUS_LIBRARY_PATH and MORPHEUS_STEMLIB_PATH must both be set."
      );
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
        // The initialization error is the one worth reporting.
      }

      return Morpheus.#unavailable(`initialization failed: ${error}`);
    }
  }

  /**
   * Without libmorpheus, the lookups silently lose every Morpheus result. This is
   * tolerated in development (e.g. to run the API or the tests without the native
   * library), but not in production, where the startup (and the Heroku release
   * phase, cf. `scripts/heroku_release.ts`) must fail instead.
   */
  static #unavailable(reason: string): Morpheus {
    if (!Settings.getSettings().isDevEnv) {
      throw new Error(`libmorpheus is unavailable: ${reason}`);
    }

    console.warn(`⚠️ libmorpheus is disabled: ${reason}`);
    return new Morpheus();
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

    let morpheusOptions = 0n;
    if (caseSensitive) morpheusOptions |= MorpheusOption.StrictCase;
    if (!diacriticSensitive) morpheusOptions |= MorpheusOption.IgnoreAccents;

    // Morpheus does not recognize contextual grave accents. They are always
    // converted to their lexical acute equivalent for analysis; the original
    // Greek surface form is preserved in the public morphology key.
    //
    // `IgnoreAccents` does not cover the breathings: a form typed without one is read
    // as smooth (e.g. `ων` misses ὅς through ὧν). When diacritics are ignored, both
    // breathings are therefore tried.
    //
    // Likewise, Morpheus lowercases a capitalized form but never capitalizes a
    // lowercase one (e.g. `διος` misses Ζεύς through Διός): when the case is ignored,
    // the capitalized variants are tried too.
    //
    // Accents and iota subscripts are removed beforehand: Morpheus treats them as
    // optional when absent, but as required when present (e.g. `ᾧ` would miss ὦ).
    const breathingForms = diacriticSensitive
      ? [graveToAcute(greekStr)]
      : buildBreathingVariants(removeAccents(greekStr));

    // A rough breathing that the user did not type is a guess of the API (cf.
    // above). Morpheus may read such a form as a crasis (article or relative +
    // word), e.g. ἁνα as ἃ + ἔνα (late Ionic accusative of εἷς): two guesses in a
    // row, which almost only produce noise. These crasis readings are dropped;
    // those of a typed breathing, or with a smooth breathing (ὦγαθε), are kept.
    const guessedRough = breathingForms.length > 1 &&
      !hasInitialRoughBreathing(greekStr);

    const forms = [
      ...new Set(
        caseSensitive
          ? breathingForms
          : breathingForms.flatMap((form) => [form, capitalize(form)])
      )
    ];

    const analyses: MorpheusAnalysis[] = [];

    // One form at a time: a failure (an internal error of libmorpheus, e.g. more than
    // 25 analyses before its 0.4.2 release) only loses the analyses of this form.
    for (const form of forms) {
      const betaCode = convert(form, "greek", "beta-code", { preset: "perseus" });
      const dropCrasis = guessedRough && hasInitialRoughBreathing(form);

      try {
        const formAnalyses = await this.#context().analyze(betaCode, morpheusOptions);
        analyses.push(
          ...(dropCrasis
            ? formAnalyses.filter((analysis) => !analysis.crasis)
            : formAnalyses)
        );
      } catch (error) {
        console.error(`libmorpheus call failed for '${betaCode}':`, error);
      }
    }

    try {
      return this.#formatMorpheusResponse(analyses, greekStr);
    } catch (error) {
      console.error("Morpheus response formatting failed:", error);
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
      morphFlags: analysis.morphFlags.toSorted(),
      // A crasis reading is distinct from a direct reading with the same grammar.
      crasis: getCrasis(analysis) ?? null
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
