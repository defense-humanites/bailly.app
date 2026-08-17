import fs from "node:fs";
import {
  KeyType,
  Preset,
  removeGreekVariants,
  toBetaCode,
  toGreek
} from "greek-conversion";
import type { ApiLookupParams, MorpheusData, MorpheusDataItem } from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { MorpheusWorkerPool } from "./MorpheusWorkerPool.ts";
import { Settings } from "./Settings.ts";

type MorpheusLookupOptions = Pick<
  ApiLookupParams<never>,
  "caseSensitive" | "diacriticSensitive"
>;

export class Morpheus {
  static #wrapper: Morpheus;

  // The actual Morpheus instances.
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

  #formatMorpheusData(rawMorpheusData: string): MorpheusDataItem[] {
    return rawMorpheusData
      .split(/^:raw\s+/m)
      .slice(1) // Remove the empty aprt that is returned before the first match.
      .map((item) => this.#formatMorpheusItem(item));
  }

  #formatMorpheusItem(morpheusItem: string): MorpheusDataItem {
    const morpheusProps = {
      workw: "",
      lem: "",
      prvb: "",
      aug1: "",
      stem: "",
      suff: "",
      end: ""
    };

    const formattedData: MorpheusDataItem = morpheusItem
      .split(/\r?\n/)
      .reduce(
        (acc, line) => {
          const [key, ...valueParts] = line.trim().split(/\s+/);

          if (!key?.startsWith(":")) {
            return acc;
          }

          acc[key.slice(1)] = valueParts.join(" ");

          return acc;
        },
        morpheusProps
      );

    formattedData.workw = removeGreekVariants(
      toGreek(formattedData.workw, KeyType.TLG_BETA_CODE)
    );
    formattedData.lem = toGreek(formattedData.lem, KeyType.TLG_BETA_CODE);

    return formattedData;
  }

  #isNeeded(str: string): boolean {
    return (
      this.isAvailable &&
      !/\s/g.test(str) && // Morpheus ignores whitespace
      !str.toLowerCase().includes("ϝ") && // Morpheus ignores letter digamma
      !str.endsWith('"') &&
      !str.endsWith(SpecialChar.explicitEnd) &&
      !str.includes(SpecialChar.singleWildcard) &&
      !str.includes(SpecialChar.wildcard)
    );
  }

  /**
   * @param greekStr A greek string. If the option `diacriticSensitive` has been set to
   *        `false`, we assume that the `greekStr` diacritics have been removed.
   * @returns Relevant morphological data grouped by lemma.
   */
  async lookup(
    greekStr: string,
    options: MorpheusLookupOptions
  ): Promise<MorpheusData> {
    if (!this.#isNeeded(greekStr)) return {};

    const { caseSensitive = false, diacriticSensitive = false } = options;
    const settings = Settings.getSettings();

    // The expected format is lower case, but the TLG style beta code is upper case.
    const betaCodeStr = toBetaCode(greekStr, KeyType.GREEK, Preset.TLG).toLowerCase();

    // Capitalize using an asterisk (following the TLG style beta code).
    const buildCaseVariants = (betaCodeStr: string): [string, string] => {
      return betaCodeStr.startsWith("*")
        ? [betaCodeStr.slice(1), betaCodeStr]
        : [betaCodeStr, `*${betaCodeStr}`];
    };

    // Breathings should be applied after an eventual asterisk (= upper case), the letter
    // rho, a valid vowel diphthong or a single vowel.
    const buildBreathingVariants = (betaCodeStr: string): [string, string] => {
      const re: RegExp = /^(\*?)(rh?|ai|ei|oi|au|eu|hu|ou|ui|[aehiouw])/gim;
      return [betaCodeStr.replace(re, "$1$2)"), betaCodeStr.replace(re, "$1$2(")];
    };

    const morpheusInput = [
      ...(!caseSensitive
        ? buildCaseVariants(betaCodeStr).map((caseVariant, i) => {
          return !diacriticSensitive
            ? buildBreathingVariants(caseVariant)
            : caseVariant;
        }).flat()
        : !diacriticSensitive
        ? buildBreathingVariants(betaCodeStr)
        : [betaCodeStr])
    ];

    if (settings.isDevEnv) {
      console.info(
        "%c./src/Morpheus.ts > lookup():",
        "font-weight:bold",
        "morpheusInput =",
        morpheusInput
      );
    }

    try {
      const formattedData = this.#formatMorpheusData(
        await this.#pool.analyze(
          morpheusInput.join("\n"),
          settings.morpheusLookupMaxDuration
        )
      );

      // Assuming that the Morpheus worker pool is using with the `-n` (non-accented
      // search) flag, we have to filter the formatted data to retain only the entries
      // if the `diacriticSensitive` option is enabled. `entry.workw` represents the
      // accented form of the unaccented search.
      const lemmaGroups = Object.groupBy(
        diacriticSensitive
          ? formattedData.filter((entry) => {
            return caseSensitive
              ? entry.workw === greekStr
              : entry.workw.toLowerCase() === greekStr.toLowerCase();
          })
          : formattedData,
        ({ lem }) => lem.replace(/\d+$/, "") // Remove the eventual trailing digits.
      ) satisfies MorpheusData;

      return lemmaGroups;
    } catch (error) {
      console.error(`Morpheus call failed with error <${error}>`);
      return {};
    }
  }
}
