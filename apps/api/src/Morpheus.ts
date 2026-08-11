import { KeyType, toBetaCode, toGreek } from "greek-conversion";
import fs from "node:fs";
import type { ApiLookupParams, MorpheusData, MorpheusDataItem } from "./definitions.ts";
import { SpecialChar } from "./enums.ts";
import { runTimeLimitedPromise } from "./helpers.ts";
import { Settings } from "./Settings.ts";

export class Morpheus {
  private static instance: Morpheus;

  private static binary: string;
  private static stemlib: string;

  static isAvailable: boolean;

  private constructor() {}

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

      const gzippedBinaryFilePath: string = `${settings.morpheusBinaryPath}.gz`;
      let gzippedBinaryExists: boolean = false;

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
        Morpheus.isAvailable = false;
        console.warn(
          `%c⚠️ Morpheus binary not found. Check that the 'MORPHEUS_BINARY_PATH'`,
          `value corresponds to an actual raw or gzipped file (current value is '${Morpheus.binary}').`,
          "font-weight: bold;color:yellow"
        );
      } else if (!stemlibExists) {
        Morpheus.isAvailable = false;
        console.warn(
          `%c⚠️ Morpheus stemlib not found. Check that the 'MORPHEUS_STEMLIB_PATH'`,
          `value corresponds to an actual file (current value is '${Morpheus.stemlib}').`,
          "font-weight: bold;color:yellow"
        );
      } else {
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

          console.info("%c✅ Morpheus binary unzipped.", "font-weight: bold;color:green");
        }

        Morpheus.binary = settings.morpheusBinaryPath;
        Morpheus.stemlib = settings.morpheusStemlibPath;
        Morpheus.isAvailable = true;

        fs.chmodSync(Morpheus.binary, fs.constants.S_IXUSR);
        console.info(
          `%c✅ Changed chmod for '${Morpheus.binary}' to ensure its executability.`,
          "font-weight: bold;color:green"
        );
      }

      Morpheus.instance = new Morpheus();
    }

    return Morpheus.instance;
  }

  private static async call(betaCodeStr: string): Promise<string> {
    // -n: ignore accents; -d: dictionary format.
    const process = new Deno.Command(Morpheus.binary, {
      args: ["-n", "-d"],
      env: { MORPHLIB: Morpheus.stemlib },
      stdin: "piped",
      stdout: "piped",
      stderr: "piped"
    }).spawn();

    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(betaCodeStr));
    await writer.close();
    writer.releaseLock();

    const output = await process.output();
    const result = new TextDecoder().decode(output.stdout);

    process.unref();
    return result;
  }

  private static formatResponse(item: string): MorpheusDataItem {
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
        {
          workw: "",
          lem: "",
          prvb: "",
          aug1: "",
          stem: "",
          suff: "",
          end: ""
        }
      );

    formattedData.workw = toGreek(formattedData.workw, KeyType.TLG_BETA_CODE);
    formattedData.lem = toGreek(formattedData.lem, KeyType.TLG_BETA_CODE);

    return formattedData;
  }

  private static isNeeded(str: string): boolean {
    return (
      Morpheus.isAvailable &&
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
    if (!Morpheus.isNeeded(greekStr)) return {};

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
      data = await runTimeLimitedPromise(Morpheus.call(searchStr));
    } catch (error) {
      console.error(`Morpheus call failed with error <${error}>`);
      return {};
    }

    const formattedData = data
      .split(/:raw.*\s+/)
      .splice(1)
      .map((item) => Morpheus.formatResponse(item));

    return <MorpheusData> (
      Object.groupBy(formattedData, ({ lem }) => lem.replace(/\d+$/, ""))
    );
  }
}
