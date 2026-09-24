import { DATABASE, MORPHEUS_VENDOR } from "./defaults.ts";
import type { DatabaseEntry } from "./definitions.ts";

const ENV_KEYS = [
  "HOST_DB",
  "DB_FILE_PATH",
  "DB_VERSION",
  "DENO_ENV",
  "MORPHEUS_LIBRARY_PATH",
  "MORPHEUS_POOL_SIZE",
  "MORPHEUS_STEMLIB_PATH",
  "PORT",
  "QUERY_ALLOWED_FIELDS",
  "QUERY_DEFAULT_FIELDS",
  "QUERY_MAX_BATCH_SIZE",
  "QUERY_MAX_ROWS",
] as const;

type EnvKeys = typeof ENV_KEYS[number];
const ENV_KV = ENV_KEYS.map((key) => ({ key, value: Deno.env.get(key) }));

function getEnv(keyName: EnvKeys): string | undefined {
  const row = ENV_KV.find(({ key }) => key === keyName);
  if (!row) throw new Error("Invalid env key");
  return row.value;
}

/** Returns an environment override, an empty value meaning no override. */
function getOverride(keyName: EnvKeys): string | undefined {
  return getEnv(keyName)?.trim() || undefined;
}

export class Settings {
  private static settings: Settings;
  isHostDb = false;
  hostDbUnderlyingPath = "";
  readonly hostDbPath = {
    bindMountedFile: "/host-db/host.db",
    copyDest: "/runtime-db/host.db",
  };
  readonly dbFilePath: string;
  readonly dbVersion: string;
  readonly denoEnv: "production" | "development";
  readonly isDevEnv: boolean;
  readonly morpheusLibraryPath: string;
  readonly morpheusPoolSize: number;
  readonly morpheusStemlibPath: string;
  readonly port: number;
  readonly queryAllowedFields: string[];
  readonly queryDefaultFields: string[];
  readonly queryMaxBatchSize: number;
  readonly queryMaxRows: number;

  private constructor() {
    this.denoEnv = getEnv("DENO_ENV") === "development"
      ? "development"
      : "production";
    this.isDevEnv = this.denoEnv === "development";
    this.port = Settings.formatNumber(getEnv("PORT"), 3000)!;

    const hostDb = getEnv("HOST_DB")?.trim();
    if (hostDb) {
      this.isHostDb = true;
      this.hostDbUnderlyingPath = hostDb;
    }
    // Defaults versioned with the code (cf. `src/defaults.ts`); the environment
    // variables are overrides only.
    this.dbFilePath = hostDb
      ? this.hostDbPath.copyDest
      : getOverride("DB_FILE_PATH") ?? DATABASE.filePath;
    this.dbVersion = getOverride("DB_VERSION") ?? DATABASE.version;

    this.morpheusLibraryPath = getOverride("MORPHEUS_LIBRARY_PATH") ??
      MORPHEUS_VENDOR.libraryPath;
    this.morpheusStemlibPath = getOverride("MORPHEUS_STEMLIB_PATH") ??
      MORPHEUS_VENDOR.dataOutput;

    // An override left in the production config would silently pin the database
    // (or libmorpheus) and mask the next change of the code: make it visible.
    if (!this.isDevEnv) {
      const overrides = (
        [
          "DB_FILE_PATH",
          "DB_VERSION",
          "MORPHEUS_LIBRARY_PATH",
          "MORPHEUS_STEMLIB_PATH"
        ] as const
      ).filter((key) => getOverride(key));

      if (overrides.length) {
        console.warn(
          `⚠️ Environment overrides in production: ${overrides.join(", ")} ` +
            "(the defaults of src/defaults.ts are ignored)."
        );
      }
    }
    this.morpheusPoolSize = Settings.formatNumber(getEnv("MORPHEUS_POOL_SIZE"), 4)!;
    if (!Number.isInteger(this.morpheusPoolSize) || this.morpheusPoolSize < 1) {
      throw new Error(`Invalid MORPHEUS_POOL_SIZE: ${this.morpheusPoolSize}`);
    }

    this.queryAllowedFields = getEnv("QUERY_ALLOWED_FIELDS")
      ? Settings.formatFields(getEnv("QUERY_ALLOWED_FIELDS")!)
      : [];
    const defaults = getEnv("QUERY_DEFAULT_FIELDS");
    this.queryDefaultFields = defaults && this.checkFields(Settings.formatFields(defaults))
      ? Settings.formatFields(defaults)
      : this.queryAllowedFields;
    this.queryMaxBatchSize = Settings.formatNumber(
      getEnv("QUERY_MAX_BATCH_SIZE"), this.isDevEnv ? Infinity : 5,
    )!;
    this.queryMaxRows = Settings.formatNumber(
      getEnv("QUERY_MAX_ROWS"), this.isDevEnv ? Infinity : 100,
    )!;

    console.info("Current settings:", {
      denoEnv: this.denoEnv,
      dbFilePath: this.dbFilePath,
      dbVersion: this.dbVersion,
      morpheusLibraryPath: this.morpheusLibraryPath,
      morpheusStemlibPath: this.morpheusStemlibPath,
      morpheusPoolSize: this.morpheusPoolSize,
      port: this.port,
    });
  }

  static getSettings(): Settings {
    if (!Settings.settings) Settings.settings = new Settings();
    return Settings.settings;
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
