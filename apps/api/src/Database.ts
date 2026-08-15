import { Database as Sqlite } from "@db/sqlite";
import { Settings } from "./Settings.ts";

export class Database {
  private static connection: Sqlite;

  private constructor() {}

  static async getConnection(): Promise<Sqlite> {
    if (!Database.connection) {
      const settings = Settings.getSettings();

      if (!settings.dbFilePath) {
        throw new Error(
          "The 'DB_FILE_PATH' environment variable hasn't been set."
        );
      }

      let dbFileExists: boolean = false;

      try {
        const dbFile = await Deno.lstat(settings.dbFilePath);
        if (dbFile.isFile) dbFileExists = true;
      } catch (err: unknown) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }

      const gzippedDbFilePath: string = `${settings.dbFilePath}.gz`;
      let gzippedDbFileExists: boolean = false;

      try {
        const gzippedDbFile = await Deno.lstat(gzippedDbFilePath);
        if (gzippedDbFile.isFile) gzippedDbFileExists = true;
      } catch (err: unknown) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }

      if (!dbFileExists && gzippedDbFileExists) {
        console.info(
          "%c⏳ Unzipping database file...",
          "font-weight: bold;color:yellow"
        );

        const input = await Deno.open(gzippedDbFilePath);
        const output = await Deno.create(settings.dbFilePath);

        await input.readable
          .pipeThrough(new DecompressionStream("gzip"))
          .pipeTo(output.writable);

        console.info("%c✅ Database file unzipped.", "font-weight: bold;color:green");
      }

      if (!dbFileExists && !gzippedDbFileExists) {
        throw new Error(
          `Database file not found. Check that the 'DB_FILE_PATH' value corresponds ` +
            `to an actual file (current value is '${settings.dbFilePath}').\n` +
            `Note: the Docker image only loads gzipped database files.`
        );
      }

      const SQLITE_OPEN_READONLY = 0x00000001;
      const SQLITE_OPEN_URI = 0x00000040;

      Database.connection = new Sqlite(
        `file:${settings.dbFilePath}?immutable=1`,
        {
          // @db/sqlite doesn't have a built-in `immutable: true|false` option.
          flags: SQLITE_OPEN_READONLY | SQLITE_OPEN_URI
        }
      );

      //Database.connection.exec("PRAGMA mmap_size = 30000000000;");
    }

    return Database.connection;
  }
}
