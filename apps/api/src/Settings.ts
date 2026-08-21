import type { DatabaseEntry } from "./definitions.ts";

const ENV_KEYS = [
  /* Docker only */

  // For arbitrary databases mounted w/ Docker during development.
  "HOST_DB",

  /* Proper .env variables */

  "DB_FILE_PATH",
  "DB_VERSION",
  "DENO_ENV",
  "MORPHEUS_BINARY_PATH",
  "MORPHEUS_LOOKUP_MAX_DURATION",
  "MORPHEUS_POOL_SIZE",
  "MORPHEUS_STEMLIB_PATH",
  "PORT",
  "QUERY_ALLOWED_FIELDS",
  "QUERY_DEFAULT_FIELDS",
  "QUERY_MAX_BATCH_SIZE",
  "QUERY_MAX_ROWS"
] as const;

type EnvKeys = typeof ENV_KEYS[number];

const ENV_KV = ENV_KEYS.map((key) => {
  return { key: key, value: Deno.env.get(key) };
});

function getEnv(keyName: EnvKeys): string {
  const row = ENV_KV.find((el) => el.key === keyName);
  if (!row) throw new Error("Invalid env key");
  return row.value;
}

export class Settings {
  private static settings: Settings;

  isHostDb: boolean = false;
  hostDbUnderlyingPath: string;

  // As in `../docker-compose.override.yml`
  readonly hostDbPath = {
    bindMountedFile: "/host-db/host.db",
    copyDest: "/runtime-db/host.db"
  };

  readonly dbFilePath: string;
  readonly dbVersion: string;

  readonly denoEnv: "production" | "development";
  readonly isDevEnv: boolean;

  readonly morpheusBinaryPath: string;
  readonly morpheusLookupMaxDuration: number = 250;
  readonly morpheusPoolSize: number = 4;
  readonly morpheusStemlibPath: string;

  readonly port: number = 3000;

  readonly queryAllowedFields: string[];
  readonly queryDefaultFields: string[];
  readonly queryMaxBatchSize: number = 5;
  readonly queryMaxRows: number = 100;

  private constructor() {
    // General

    this.denoEnv = (() => {
      const value: string = getEnv("DENO_ENV");
      if (value !== "production" && value !== "development") {
        return "production";
      } else return value;
    })();
    this.isDevEnv = this.denoEnv === "development";

    this.port = Settings.formatNumber(getEnv("PORT")) ?? this.port;

    // Database

    this.dbFilePath = (() => {
      if (getEnv("HOST_DB")?.trim()) {
        this.isHostDb = true;
        this.hostDbUnderlyingPath = getEnv("HOST_DB");
        return this.hostDbPath.copyDest;
      }
      return getEnv("DB_FILE_PATH") ?? "";
    })();

    // @FIXME it should be wrapped in the database itself.
    this.dbVersion = getEnv("DB_VERSION") ?? "";

    // Morpheus

    this.morpheusBinaryPath = getEnv("MORPHEUS_BINARY_PATH") ?? "";

    this.morpheusLookupMaxDuration = Settings.formatNumber(
      getEnv("MORPHEUS_LOOKUP_MAX_DURATION"),
      this.isDevEnv ? 1_000_000 : this.morpheusLookupMaxDuration
    );

    this.morpheusPoolSize = (() => {
      const value: number = Settings.formatNumber(getEnv("MORPHEUS_POOL_SIZE")) ??
        this.morpheusPoolSize;
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(
          `Invalid environment value for 'MORPHEUS_POOL_SIZE': ${value}`
        );
      }
      return value;
    })();

    this.morpheusStemlibPath = getEnv("MORPHEUS_STEMLIB_PATH") ?? "";

    // Query params

    this.queryAllowedFields = getEnv("QUERY_ALLOWED_FIELDS")
      ? (Settings.formatFields(
        getEnv("QUERY_ALLOWED_FIELDS")
      ) as (keyof DatabaseEntry)[])
      : [];

    this.queryDefaultFields = getEnv("QUERY_DEFAULT_FIELDS") &&
        this.checkFields(Settings.formatFields(getEnv("QUERY_DEFAULT_FIELDS")))
      ? (Settings.formatFields(
        getEnv("QUERY_DEFAULT_FIELDS")
      ) as (keyof DatabaseEntry)[])
      : this.queryAllowedFields;

    this.queryMaxBatchSize = (() => {
      const value: number = Settings.formatNumber(
        getEnv("QUERY_MAX_BATCH_SIZE"),
        this.isDevEnv ? Infinity : this.queryMaxBatchSize
      );
      if (
        Number.isNaN(value) ||
        Number.isFinite(value) && !Number.isInteger(value)
      ) {
        throw new Error(
          `Invalid environment value for 'QUERY_MAX_BATCH_SIZE': ${value}`
        );
      }
      return value;
    })();

    this.queryMaxRows = (() => {
      const value: number = Settings.formatNumber(
        getEnv("QUERY_MAX_ROWS"),
        this.isDevEnv ? Infinity : this.queryMaxRows
      );
      if (
        Number.isNaN(value) ||
        Number.isFinite(value) && !Number.isInteger(value)
      ) {
        throw new Error(
          `Invalid environment value for 'QUERY_MAX_ROWS': ${value}`
        );
      }
      return value;
    })();

    console.info("%cCurrent settings:", "font-weight: bold");
    console.info("* denoEnv:", this.denoEnv);
    console.info(
      `* dbFilePath: ${this.dbFilePath}${
        this.isHostDb ? ` -> %c${this.hostDbUnderlyingPath}` : "%c"
      }`,
      "color:cyan"
    );
    if (this.isHostDb) {
      console.warn(
        "%c  ⚠️ This is an arbitrarily mounted database from the host file system.",
        "color:yellow"
      );
    }
    console.info("* dbVersion:", this.dbVersion);
    console.info("* morpheusBinaryPath:", this.morpheusBinaryPath);
    console.info(
      "* morpheusLookupMaxDuration:",
      this.morpheusLookupMaxDuration
    );
    console.info("* morpheusPoolSize:", this.morpheusPoolSize);
    console.info("* morpheusStemlibPath:", this.morpheusStemlibPath);
    console.info("* port:", this.port);
    console.info("* queryAllowedFields:", this.queryAllowedFields);
    console.info("* queryDefaultFields:", this.queryDefaultFields);
    console.info("* queryMaxBatchSize:", this.queryMaxBatchSize);
    console.info("* queryMaxRows:", this.queryMaxRows);
  }

  static getSettings(): Settings {
    if (!Settings.settings) Settings.settings = new Settings();
    return Settings.settings;
  }

  checkFields(fields: string[]): boolean {
    return fields.every((field) => this.queryAllowedFields.includes(field));
  }

  static formatFields(fields: string): string[] {
    return fields.replace(/\s/g, "").split(",");
  }

  static formatNumber(
    value: string | null | undefined,
    defaults: number | null = null
  ): number | null {
    return (["-1", "", null, undefined].includes(value)) ? defaults : Number(value);
  }
}
