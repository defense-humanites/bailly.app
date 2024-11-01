import { Database as Sqlite } from "jsr:@db/sqlite";
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
        console.info("⏳ Unzipping database file...");

        const input = await Deno.open(gzippedDbFilePath);
        const output = await Deno.create(settings.dbFilePath);

        await input.readable
          .pipeThrough(new DecompressionStream("gzip"))
          .pipeTo(output.writable);

        console.info("✅ Database file unzipped.");
      }

      if (!dbFileExists && !gzippedDbFileExists) {
        throw new Error(
          `Database file not found. Check that the 'DB_FILE_PATH' value ` +
            `corresponds to an actual file (current value is ` +
            `'${settings.dbFilePath}').`
        );
      }

      Database.connection = new Sqlite(settings.dbFilePath, {
        create: false,
        readonly: true
      });

      Database.connection.exec("PRAGMA mmap_size = 30000000000;");
    }

    return Database.connection;
  }
}
