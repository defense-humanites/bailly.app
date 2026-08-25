import fs from "node:fs";
import {
  KeyType,
  Preset,
  removeGreekVariants,
  toBetaCode,
  toGreek
} from "greek-conversion";
import type { ApiLookupParams } from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { MorpheusWorkerPool } from "./MorpheusWorkerPool.ts";
import { Settings } from "./Settings.ts";
import {
  type MorpheusAnalysis,
  MorpheusParser,
  type Morphology
} from "./MorpheusParser.ts";

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

  /**
   * The actual Morpheus instances.
   * @private
   */
  readonly #pool: MorpheusWorkerPool;

  readonly #binary: string;
  readonly #stemlib: string;

  readonly isAvailable: boolean;

  private constructor(isAvailable: boolean) {
    const settings = Settings.getSettings();

    this.#binary = settings.morpheusBinaryPath;
    this.#stemlib = settings.morpheusStemlibPath;
    this.isAvailable = isAvailable;

    if (this.isAvailable) {
      fs.chmodSync(this.#binary, fs.constants.S_IXUSR);
      console.info(
        `%c✅ Changed chmod for '${this.#binary}' to ensure its executability.`,
        "font-weight: bold;color:green"
      );

      // Create a pool of Morpheus workers launched with the following arguments:
      //
      //   - `-d`: dictionary format (easier to parse response); e.g.
      //
      //         1 | :raw logos
      //         2 |
      //         3 | :workw lo/gos
      //         4 | :lem lo/gos
      //         5 | :prvb
      //         6 | :aug1
      //         7 | :stem log        masc                   os_ou
      //         8 | :suff
      //         9 | :end os  masc nom sg                    os_ou
      //
      //   - `-n`: non-accented search. (For strict searches, Morpheus results need
      //           to be filtered Deno-side. Another solution would be to create two
      //           different worker pools; one for non-accented searches (with the `-n`
      //           flag) and another for accented searches (without the flag)—supposing
      //           at least two child processes.)
      //
      this.#pool = new MorpheusWorkerPool(["-d", "-n"]);
    }
  }

  /**
   * An async initializer that checks and bootstrap the Morpheus binary and data. This
   * should be called before the constructor, and the returned value passed to it.
   * @returns A boolean representing the availability of the Morpheus binary and data.
   */
  static async #init(): Promise<boolean> {
    const settings = Settings.getSettings();
    const gzippedBinaryFilePath: string = `${settings.morpheusBinaryPath}.gz`;

    let binaryExists: boolean = false;
    let gzippedBinaryExists: boolean = false;

    if (settings.morpheusBinaryPath) {
      try {
        const binaryFile = await Deno.lstat(settings.morpheusBinaryPath);
        if (binaryFile.isFile) binaryExists = true;
      } catch (err: unknown) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }
    }

    try {
      const gzippedBinaryFile = await Deno.lstat(gzippedBinaryFilePath);
      if (gzippedBinaryFile.isFile) gzippedBinaryExists = true;
    } catch (err: unknown) {
      if (!(err instanceof Deno.errors.NotFound)) throw err;
    }

    let stemlibExists: boolean = false;

    if (settings.morpheusStemlibPath) {
      try {
        const stemlibDir = await Deno.lstat(settings.morpheusStemlibPath);
        if (stemlibDir.isDirectory) stemlibExists = true;
      } catch (err: unknown) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }
    }

    if (!binaryExists && !gzippedBinaryExists) {
      console.warn(
        `%c⚠️ Morpheus binary not found. Check that the 'MORPHEUS_BINARY_PATH' value corresponds to an actual raw or gzipped file (current value is '${settings.morpheusBinaryPath}').`,
        "font-weight: bold;color:yellow"
      );
      return false;
    }

    if (!stemlibExists) {
      console.warn(
        `%c⚠️ Morpheus stemlib not found. Check that the 'MORPHEUS_STEMLIB_PATH' value corresponds to an actual file (current value is '${settings.morpheusStemlibPath}').`,
        "font-weight: bold;color:yellow"
      );
      return false;
    }

    // @fixme add try/catch to fail if the binary isn't wrote correctly.
    if (!binaryExists && gzippedBinaryExists) {
      console.info(
        "%c⏳ Unzipping Morpheus binary...",
        "font-weight: bold;color:yellow"
      );

      const input = await Deno.open(gzippedBinaryFilePath);
      const output = await Deno.create(settings.morpheusBinaryPath);

      await input.readable
        .pipeThrough(new DecompressionStream("gzip"))
        .pipeTo(output.writable);

      console.info(
        "%c✅ Morpheus binary unzipped.",
        "font-weight: bold;color:green"
      );
    }

    return true;
  }

  static async getMorpheus(): Promise<Morpheus> {
    if (!this.#wrapper) this.#wrapper = new Morpheus(await Morpheus.#init());
    return this.#wrapper;
  }

  #analysisKey(analysis: MorpheusAnalysis): string {
    const m = analysis.morphology;

    return JSON.stringify({
      // Don't keep the eventual upper case mark `*`.
      lemma: analysis.lemma?.replace(/^\*/, ""),
      partOfSpeech: m?.partOfSpeech,
      gender: m?.gender?.toSorted(),
      case: m?.case?.toSorted(),
      number: m?.number?.toSorted(),
      tense: m?.tense,
      mood: m?.mood,
      voice: m?.voice,
      person: m?.person,
      degree: m?.degree,
      dialects: m?.dialects?.toSorted(),
      features: m?.features?.toSorted()
    });
  }

  #deduplicateAnalyses(
    analyses: MorpheusAnalysis[]
  ): MorpheusAnalysis[] {
    const unique = new Map<string, MorpheusAnalysis>();

    for (const analysis of analyses) {
      unique.set(this.#analysisKey(analysis), analysis);
    }

    return [...unique.values()];
  }

  /**
   * @param rawData Morpheus output potentially containing multiple analysis blocks,
   * where a block begins with a `:raw` tag and is made of several lines starting by
   * `:<tag>` tags.
   * @private
   */
  #formatMorpheusRawData(rawData: string): MorpheusAnalysis[] {
    return rawData.split(/(?=^:raw\s+)/m)
      .filter((rawDataBlock) => rawDataBlock.trim())
      .map((rawDataBlock) => new MorpheusParser(rawDataBlock).parse());
  }

  // @FIXME Verify if it's not blocking valid requests.
  #isNeeded(str: string): boolean {
    return (
      this.isAvailable &&
      !/\s/.test(str) && // Morpheus ignores whitespace
      !str.toLowerCase().includes("ϝ") && // Morpheus ignores letter digamma
      !str.startsWith('"') &&
      !str.startsWith(SpecialChar.explicitStart) &&
      !str.endsWith('"') &&
      !str.endsWith(SpecialChar.explicitEnd) &&
      !str.includes(SpecialChar.singleWildcard) &&
      !str.includes(SpecialChar.wildcard)
    );
  }

  /**
   * Builds lower/upper case variants for a beta code string.
   * @remarks Capitalize using an asterisk (following the TLG style beta code).
   * @param betaCodeStr
   * @private
   */
  #buildCaseVariants(betaCodeStr: string): [string, string] {
    return betaCodeStr.startsWith("*")
      ? [betaCodeStr.slice(1), betaCodeStr]
      : [betaCodeStr, `*${betaCodeStr}`];
  }

  /**
   * Builds smooth/rough breathings variants for a beta code string.
   * @remarks Breathings should be applied after an eventual asterisk (= upper case),
   * the letter rho, a valid vowel diphthong or a single vowel.
   * @param betaCodeStr
   * @private
   */
  #buildBreathingVariants(betaCodeStr: string): [string, string] {
    const re: RegExp = /^(\*?)(rh?|ai|ei|oi|au|eu|hu|ou|ui|[aehiouw])/gim;
    return [betaCodeStr.replace(re, "$1$2)"), betaCodeStr.replace(re, "$1$2(")];
  }

  /**
   * @param greekStr A greek string. If the option `diacriticSensitive` has been set to
   *        `false`, we assume that the `greekStr` diacritics have been removed.
   * @returns Relevant morphological data grouped by lemma.
   */
  async lookup(
    greekStr: string,
    options: MorpheusLookupOptions
  ): Promise<MorpheusResponse<MorpheusAnalysis>> {
    const settings = Settings.getSettings();

    if (!this.#isNeeded(greekStr)) {
      if (settings.isDevEnv) {
        console.log(
          `%cInvalid input '${greekStr}' (will return an empty response).`,
          "color:orange"
        );
      }
      return {};
    }

    const { caseSensitive = false, diacriticSensitive = false } = options;

    // The expected format is lower case, but the TLG style beta code is upper case.
    const betaCodeStr = toBetaCode(greekStr, KeyType.GREEK, Preset.TLG)
      .toLowerCase();

    const morpheusInput = [
      ...(!caseSensitive
        ? this.#buildCaseVariants(betaCodeStr).map((caseVariant) => {
          return !diacriticSensitive
            ? this.#buildBreathingVariants(caseVariant)
            : caseVariant;
        }).flat()
        : !diacriticSensitive
        ? this.#buildBreathingVariants(betaCodeStr)
        : [betaCodeStr])
    ];

    /*if (settings.isDevEnv) {
      console.info(
        "%c./src/Morpheus.ts > lookup():",
        "font-weight:bold",
        "morpheusInput =",
        morpheusInput
      );
    }*/

    try {
      const analyses = this.#formatMorpheusRawData(
        await this.#pool.analyze(
          morpheusInput.join("\n"),
          settings.morpheusLookupMaxDuration
        )
      );

      return this.#formatMorpheusResponse(analyses, greekStr, options);
    } catch (error) {
      console.error(`Morpheus call failed with error <${error}>`);
      return {};
    }
  }

  #formatMorpheusResponse(
    analyses: MorpheusAnalysis[],
    greekStr: string,
    options: MorpheusLookupOptions
  ): MorpheusResponse<MorpheusAnalysis> {
    const { caseSensitive, diacriticSensitive } = options;

    // As we can pass multiple—potentially equivalent-queries in one Morpheus call (e.g.
    // when checking for both lower & upper case), we need to deduplicate the analyses.
    const uniqueAnalyses = this.#deduplicateAnalyses(analyses);

    // Assuming that the Morpheus worker pool is running with the `-n` (non-accented
    // search) flag, we have to filter the analyses to retain only the entries matching
    // the search string if the `diacriticSensitive` option is enabled. Note: `workWord`
    // represents the accented form of the unaccented search.
    const filteredUniqueAnalyses = diacriticSensitive
      ? uniqueAnalyses.filter((analysis) => {
        if (!analysis.workWord) {
          return false;
        }

        const normalizedWorkWord = removeGreekVariants(
          toGreek(analysis.workWord, KeyType.TLG_BETA_CODE)
        );
        return caseSensitive
          ? normalizedWorkWord === greekStr
          : normalizedWorkWord.toLowerCase() === greekStr.toLowerCase();
      })
      : uniqueAnalyses;

    const uniqueAnalysesGroupedByLemmasPlusWorkWord = Object.groupBy(
      filteredUniqueAnalyses.filter(({ lemma, workWord }) =>
        Boolean(lemma && workWord)
      ),
      // As pipes `|` are part of the beta code writting system, build a temporary key
      // format <lemma@workWord>, even if the outputted format is <lemma|wordWord> (see infra).
      ({ lemma, workWord }) => `${lemma}@${workWord}`
    );

    return Object.fromEntries(
      Object.entries(uniqueAnalysesGroupedByLemmasPlusWorkWord).map(
        ([lemmaPlusWorkWord, analyses]) => {
          const TLG: KeyType = KeyType.TLG_BETA_CODE;

          // Decode the previously formatted key.
          let [lemma, workWord] = lemmaPlusWorkWord.split("@");

          /* ------------------------------------------------------------------------ */
          // BEGIN Lemmas canonicalization
          /* ------------------------------------------------------------------------ */
          if (lemma === "tis") lemma = "ti\\s";

          // Remove any trailing number (disambiguation order isn't guaranteed to match
          // those of the Bailly).
          lemma = lemma.replace(/\d+$/, "");

          const isContracted = analyses?.some(
            ({ morphology }) => morphology?.features?.includes("contracted")
          );

          // Match the Bailly canonical form for contracted verbs; e.g. '*ω-ῶ'.
          if (isContracted && lemma.endsWith("w")) lemma = `${lemma}-w=`;

          let lemmaAsGreekStr = toGreek(lemma, TLG, {
            betaCodeStyle: { skipSanitization: true, useTLGStyle: true }
          });
          /* ------------------------------------------------------------------------ */
          // END Lemmas canonicalization
          /* ------------------------------------------------------------------------ */

          return [
            // Build a key format <lemma|wordWord> that is both readable and flexible.
            [lemmaAsGreekStr, toGreek(workWord, TLG)].join("|"),
            analyses
          ];
        }
      )
    );
  }
}
