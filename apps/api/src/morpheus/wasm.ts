/**
 * `Lemmatizer` over the WebAssembly build of libmorpheus (`@libmorpheus/wasm`).
 *
 * One module instance holds its own copy of the stem data in memory (MEMFS: the
 * fastest placement, cf. the binding's README) and one Greek context, created once
 * and reused: a context is single-threaded and `analyze()` never yields, so the
 * calls of one event loop cannot interleave inside it.
 *
 * Where the module comes from depends on the platform (cf. `MorpheusModuleSource`):
 *   - Node.js: the facade loads `morpheus.mjs` and compiles `morpheus.wasm` itself;
 *   - Cloudflare Workers: compiling WebAssembly from bytes is forbidden, so the
 *     Worker imports the `.wasm` as a module and the loader statically, and passes
 *     both (`src/worker.ts`).
 *
 * If libmorpheus aborts (a fatal error of the C runtime, which only the instance
 * suffers), the instance is discarded and recreated on the next call, from the same
 * sources.
 */

import {
  createMorpheus,
  type CreateMorpheusOptions,
  type Morpheus as MorpheusInstance,
  type MorpheusContext,
  MorpheusError,
  MorpheusLanguage,
  MorpheusOption,
  type StemlibEntries
} from "@libmorpheus/wasm";
import { decodeAnalysis } from "./decode.ts";
import {
  type AnalyzeOptions,
  type Lemmatizer,
  LemmatizerError,
  type MorpheusAnalysis
} from "./lemmatizer.ts";

/**
 * How to instantiate the module (cf. `createMorpheus()` of `@libmorpheus/wasm`):
 * nothing on Node.js; `factory` and `wasmModule` on Cloudflare Workers.
 */
export type MorpheusModuleSource = Pick<
  CreateMorpheusOptions,
  "factory" | "wasmModule" | "moduleUrl"
>;

export type WasmLemmatizerOptions = {
  module?: MorpheusModuleSource;
  /**
   * The Greek stem data (`Greek/…` paths, cf. `stemlib.ts`): the whole runtime
   * subset, read lazily by the analyses beyond the files `open()` validates.
   */
  stemlib: () => StemlibEntries | Promise<StemlibEntries>;
};

type Instance = {
  morpheus: MorpheusInstance;
  context: MorpheusContext;
};

export class WasmLemmatizer implements Lemmatizer {
  readonly #options: WasmLemmatizerOptions;
  #instance: Promise<Instance> | undefined;

  /** How many times the module was instantiated (diagnostics, cf. `worker.ts`). */
  instantiations = 0;

  private constructor(options: WasmLemmatizerOptions) {
    this.#options = options;
  }

  /**
   * Creates the lemmatizer and its first instance (so that a configuration error
   * surfaces at startup rather than at the first request).
   */
  static async create(options: WasmLemmatizerOptions): Promise<WasmLemmatizer> {
    const lemmatizer = new WasmLemmatizer(options);
    await lemmatizer.#ready();
    return lemmatizer;
  }

  /**
   * Creates the lemmatizer without instantiating the module: the first analysis
   * does. For a Worker, whose isolates start often and whose requests mostly need
   * no analysis (entries, random entries, excerpts): they no longer pay for it.
   */
  static lazy(options: WasmLemmatizerOptions): WasmLemmatizer {
    return new WasmLemmatizer(options);
  }

  #ready(): Promise<Instance> {
    this.#instance ??= this.#instantiate().catch((error) => {
      // A failed instantiation is retried by the next call.
      this.#instance = undefined;
      throw error;
    });

    return this.#instance;
  }

  async #instantiate(): Promise<Instance> {
    this.instantiations++;
    const morpheus = await createMorpheus(this.#options.module);
    const root = morpheus.writeStemlib(await this.#options.stemlib());
    const context = morpheus.open({ stemlib: root, language: MorpheusLanguage.Greek });

    return { morpheus, context };
  }

  async analyze(
    betaCode: string,
    { strictCase, ignoreAccents }: AnalyzeOptions
  ): Promise<MorpheusAnalysis[]> {
    const { context } = await this.#ready();

    let flags = 0n;
    if (strictCase) flags |= MorpheusOption.StrictCase;
    if (ignoreAccents) flags |= MorpheusOption.IgnoreAccents;

    try {
      return context.analyze(betaCode, flags).map(decodeAnalysis);
    } catch (error) {
      if (error instanceof MorpheusError) {
        // A failure of this form only (e.g. an internal error): the instance is
        // intact.
        throw new LemmatizerError(error.status, error.message);
      }

      // Anything else (an abort of the C runtime, a trap) leaves the instance in an
      // unknown state: discard it, the next call starts afresh.
      this.#instance = undefined;
      throw error;
    }
  }
}
