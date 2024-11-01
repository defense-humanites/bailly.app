import type { DatabaseEntry } from "./definitions.ts";

const DB_FILE_PATH = Deno.env.get("DB_FILE_PATH");
const DB_VERSION = Deno.env.get("DB_VERSION");
const MORPHEUS_BINARY_PATH = Deno.env.get("MORPHEUS_BINARY_PATH");
const MORPHEUS_LOOKUP_MAX_DURATION = Deno.env.get("MORPHEUS_LOOKUP_MAX_DURATION"); // prettier-ignore
const MORPHEUS_STEMLIB_PATH = Deno.env.get("MORPHEUS_STEMLIB_PATH");
const PORT = Deno.env.get("PORT");
const QUERY_ALLOWED_FIELDS = Deno.env.get("QUERY_ALLOWED_FIELDS");
const QUERY_DEFAULT_FIELDS = Deno.env.get("QUERY_DEFAULT_FIELDS");
const QUERY_MAX_ROWS = Deno.env.get("QUERY_MAX_ROWS");

export class Settings {
  private static settings: Settings;

  readonly dbFilePath: string;
  readonly dbVersion: string;
  readonly morpheusBinaryPath: string;
  readonly morpheusLookupMaxDuration: number;
  readonly morpheusStemlibPath: string;
  readonly port: number;
  readonly queryAllowedFields: string[];
  readonly queryDefaultFields: string[];
  readonly queryMaxRows: number;

  private constructor() {
    // General

    this.port = Number(PORT ?? 3000);

    // Database

    this.dbFilePath = DB_FILE_PATH ?? "";
    this.dbVersion = DB_VERSION ?? "";

    // Morpheus

    this.morpheusBinaryPath = MORPHEUS_BINARY_PATH ?? "";
    this.morpheusLookupMaxDuration = Number(
      MORPHEUS_LOOKUP_MAX_DURATION ?? 100
    );
    this.morpheusStemlibPath = MORPHEUS_STEMLIB_PATH ?? "";

    // Query params

    this.queryAllowedFields = QUERY_ALLOWED_FIELDS
      ? (Settings.formatFields(QUERY_ALLOWED_FIELDS) as (keyof DatabaseEntry)[])
      : [];
    this.queryDefaultFields =
      QUERY_DEFAULT_FIELDS &&
      this.checkFields(Settings.formatFields(QUERY_DEFAULT_FIELDS))
        ? (Settings.formatFields(
            QUERY_DEFAULT_FIELDS
          ) as (keyof DatabaseEntry)[])
        : this.queryAllowedFields;
    this.queryMaxRows = Number(QUERY_MAX_ROWS ?? -1);
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
}
