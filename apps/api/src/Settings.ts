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
    this.dbFilePath = hostDb ? this.hostDbPath.copyDest : getEnv("DB_FILE_PATH") ?? "";
    this.dbVersion = getEnv("DB_VERSION") ?? "";

    this.morpheusLibraryPath = getEnv("MORPHEUS_LIBRARY_PATH") ?? "";
    this.morpheusStemlibPath = getEnv("MORPHEUS_STEMLIB_PATH") ?? "";
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
