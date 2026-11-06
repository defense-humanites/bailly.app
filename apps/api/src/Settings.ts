import { DATABASE } from "./defaults.ts";
import type { DatabaseEntry } from "./definitions.ts";

/**
 * The environment of the API, wherever it runs: `process.env` on Node.js, the `env`
 * of the Worker on Cloudflare (its `vars`, cf. `wrangler.jsonc`, next to its
 * bindings). Only the string values are settings.
 */
export type Environment = object;

const ENV_KEYS = [
  "API_ENV",
  "DB_FILE_PATH",
  "DB_VERSION",
  "MORPHEUS_DATA_PATH",
  "PORT",
  "QUERY_ALLOWED_FIELDS",
  "QUERY_DEFAULT_FIELDS",
  "QUERY_MAX_BATCH_SIZE",
  "QUERY_MAX_ROWS"
] as const;

type EnvKey = typeof ENV_KEYS[number];

export class Settings {
  static #settings: Settings | undefined;

  readonly #env: Environment;

  /** `development` enables the diagnostics and lifts the batch and row limits. */
  readonly apiEnv: "production" | "development";
  readonly isDevEnv: boolean;
  /** SQLite file of the dictionary (Node.js only; D1 is bound by the Worker). */
  readonly dbFilePath: string;
  /** Date of the dictionary data, exposed as `version` in every response. */
  readonly dbVersion: string;
  /** Directory of the Morpheus stem data (Node.js only; bundled in the Worker). */
  readonly morpheusDataPath: string;
  readonly port: number;
  readonly queryAllowedFields: string[];
  readonly queryDefaultFields: string[];
  readonly queryMaxBatchSize: number;
  readonly queryMaxRows: number;

  private constructor(env: Environment) {
    this.#env = env;

    this.apiEnv = this.#get("API_ENV") === "development"
      ? "development"
      : "production";
    this.isDevEnv = this.apiEnv === "development";
    this.port = Settings.formatNumber(this.#get("PORT"), 3000)!;

    // Defaults versioned with the code (cf. `src/defaults.ts`); the environment
    // variables are overrides only.
    this.dbFilePath = this.#override("DB_FILE_PATH") ?? DATABASE.filePath;
    this.dbVersion = this.#override("DB_VERSION") ?? DATABASE.version;
    this.morpheusDataPath = this.#override("MORPHEUS_DATA_PATH") ?? "morpheus-data";

    // An override left in the production config would silently pin the database
    // and mask the next change of the code: make it visible.
    if (!this.isDevEnv) {
      const overrides = (["DB_FILE_PATH", "DB_VERSION"] as const)
        .filter((key) => this.#override(key));

      if (overrides.length) {
        console.warn(
          `⚠️ Environment overrides in production: ${overrides.join(", ")} ` +
            "(the defaults of src/defaults.ts are ignored)."
        );
      }
    }

    this.queryAllowedFields = this.#get("QUERY_ALLOWED_FIELDS")
      ? Settings.formatFields(this.#get("QUERY_ALLOWED_FIELDS")!)
      : [];
    const defaults = this.#get("QUERY_DEFAULT_FIELDS");
    this.queryDefaultFields = defaults && this.checkFields(Settings.formatFields(defaults))
      ? Settings.formatFields(defaults)
      : this.queryAllowedFields;
    this.queryMaxBatchSize = Settings.formatNumber(
      this.#get("QUERY_MAX_BATCH_SIZE"),
      this.isDevEnv ? Infinity : 5
    )!;
    this.queryMaxRows = Settings.formatNumber(
      this.#get("QUERY_MAX_ROWS"),
      this.isDevEnv ? Infinity : 100
    )!;
  }

  #get(key: EnvKey): string | undefined {
    const value = (this.#env as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  }

  /** An environment override, an empty value meaning no override. */
  #override(key: EnvKey): string | undefined {
    return this.#get(key)?.trim() || undefined;
  }

  /**
   * Reads the settings from `env`, once: the entry point (Node.js server, Worker,
   * tests) calls it before the first request; `getSettings()` then serves them.
   * A second call with another environment is an error (the settings are global).
   */
  static configure(env: Environment): Settings {
    if (Settings.#settings) {
      if (Settings.#settings.#env !== env) {
        throw new Error("The settings have already been configured.");
      }
      return Settings.#settings;
    }

    Settings.#settings = new Settings(env);
    return Settings.#settings;
  }

  static getSettings(): Settings {
    if (!Settings.#settings) {
      throw new Error(
        "The settings haven't been configured: cf. Settings.configure()."
      );
    }
    return Settings.#settings;
  }

  /** Forgets the settings (tests). */
  static reset(): void {
    Settings.#settings = undefined;
  }

  /** The settings worth logging at startup. */
  summary(): Record<string, unknown> {
    return {
      apiEnv: this.apiEnv,
      dbFilePath: this.dbFilePath,
      dbVersion: this.dbVersion,
      morpheusDataPath: this.morpheusDataPath,
      port: this.port,
      queryMaxBatchSize: this.queryMaxBatchSize,
      queryMaxRows: this.queryMaxRows
    };
  }

  checkFields(fields: string[]): boolean {
    return fields.every((field) => this.queryAllowedFields.includes(field));
  }

  static formatFields(fields: string): (keyof DatabaseEntry)[] {
    return fields.replace(/\s/g, "").split(",") as (keyof DatabaseEntry)[];
  }

  static formatNumber(value: string | null | undefined, fallback: number | null = null) {
    return ["-1", "", null, undefined].includes(value) ? fallback : Number(value);
  }
}
