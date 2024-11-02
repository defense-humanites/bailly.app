import { KeyType, toBetaCode, toGreek } from "greek-conversion";
import fs from "node:fs";
import type {
  ApiLookupParams,
  MorpheusData,
  MorpheusDataItem
} from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { runTimeLimitedPromise } from "./helpers.ts";
import { Settings } from "./Settings.ts";

export class Morpheus {
  private static instance: Morpheus;

  private readonly binary: string;
  private readonly stemlib: string;

  readonly isAvailable: boolean;

  private constructor(binaryExists: boolean, stemlibExists: boolean) {
    const settings = Settings.getSettings();
    this.binary = settings.morpheusBinaryPath;
    this.stemlib = settings.morpheusStemlibPath;

    if (!binaryExists) {
      this.isAvailable = false;
      console.warn(
        `⚠️ Morpheus binary not found. Check that the 'MORPHEUS_BINARY_PATH'`,
        `value corresponds to an actual file (current value is '${this.binary}').`
      );
    } else if (!stemlibExists) {
      this.isAvailable = false;
      console.warn(
        `⚠️ Morpheus stemlib not found. Check that the 'MORPHEUS_STEMLIB_PATH'`,
        `value corresponds to an actual file (current value is '${this.stemlib}').`
      );
    } else {
      this.isAvailable = true;

      fs.chmod(this.binary, fs.constants.S_IXUSR, (error) => {
        try {
          if (error) throw error;
          console.info(
            `✅ Changed chmod for '${this.binary}' to ensure its executability.`
          );
        } catch (error: unknown) {
          console.error(error);
        }
      });
    }
  }

  static async getMorpheus(): Promise<Morpheus> {
    if (!Morpheus.instance) {
      const settings = Settings.getSettings();

      let binaryExists: boolean = false;

      if (settings.morpheusBinaryPath) {
        try {
          const binaryFile = await Deno.lstat(settings.morpheusBinaryPath);
          if (binaryFile.isFile) binaryExists = true;
        } catch (err: unknown) {
          if (!(err instanceof Deno.errors.NotFound)) throw err;
        }
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

      Morpheus.instance = new Morpheus(binaryExists, stemlibExists);
    }

    return Morpheus.instance;
  }

  private async call(betaCodeStr: string): Promise<string> {
    // -n: ignore accents; -d: dictionary format.
    const process = new Deno.Command("morpheus/cruncher", {
      args: ["-n", "-d"],
      env: { MORPHLIB: "morpheus/stemlib" },
      stdin: "piped",
      stdout: "piped"
    }).spawn();

    const writer = process.stdin.getWriter();
    writer.write(new TextEncoder().encode(betaCodeStr));
    writer.releaseLock();

    await process.stdin.close();

    const output = await process.output();
    const result = new TextDecoder().decode(output.stdout);

    process.unref();
    return result;
  }

  private formatResponse(item: string): MorpheusDataItem {
    const formattedData: MorpheusDataItem = item
      .split(":")
      .splice(1)
      .reduce(
        (acc, curr) => {
          const [key, value] = curr.split(" ", 2);
          // @ts-ignore: @fixme
          acc[key] = value.trim();
          return acc;
        },
        { workw: "", lem: "", prvb: "", aug1: "", stem: "", suff: "", end: "" }
      );

    formattedData.workw = toGreek(formattedData.workw, KeyType.TLG_BETA_CODE);
    formattedData.lem = toGreek(formattedData.lem, KeyType.TLG_BETA_CODE);

    return formattedData;
  }

  private isNeeded(str: string): boolean {
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
   * @param greekStr A greek string.
   * @returns Relevant morphological data grouped by lemma.
   */
  async lookup(
    greekStr: string,
    { caseSensitive }: Pick<ApiLookupParams<never>, "caseSensitive">
  ): Promise<MorpheusData> {
    if (!this.isNeeded(greekStr)) return {};

    const searchStr = (() => {
      const isCapitalized: boolean = greekStr[0] !== greekStr[0].toLowerCase();

      // Capitalize using an asterisk (TLG style beta code).
      let result: string = toBetaCode(greekStr, KeyType.GREEK).toLowerCase();
      if (isCapitalized && caseSensitive) result = `*${result}`;
      if (!caseSensitive) result = `${result}\n*${result}`;

      // Morpheus assumes a smooth breathing if none have been noted.
      const resultRough: string = result.replace(
        /^(\*?)(rh?|[aehiouw]+)/gim,
        (m, $1, $2) => {
          if ($1) return $1 + "(" + $2;
          else return $2 + "(";
        }
      );

      return `${result}\n${resultRough}`;
    })();

    let data: string;

    try {
      data = await runTimeLimitedPromise(this.call(searchStr));
    } catch (error) {
      console.error(`Morpheus call failed with error <${error}>`);
      return {};
    }

    const formattedData = data
      .split(/:raw.*\s+/)
      .splice(1)
      .map((item) => this.formatResponse(item));

    return <MorpheusData>(
      Object.groupBy(formattedData, ({ lem }) => lem.replace(/\d+$/, ""))
    );
  }
}
