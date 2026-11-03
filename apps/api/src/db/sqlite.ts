/**
 * `Dictionary` over a SQLite file, through `node:sqlite` (Node.js 22.13+, built in:
 * no native build step). Used by the Node.js server and by the tests.
 *
 * The file is opened read-only and immutable (`?immutable=1`: no locking, no journal
 * check; safe since nothing ever writes to it). If it is missing but its `.gz`
 * archive exists (the form in which a revision is committed), the archive is
 * decompressed next to it first.
 */

import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import type { Dictionary, SqlStatement, SqlValue } from "./dictionary.ts";

export class SqliteDictionary implements Dictionary {
  readonly #db: DatabaseSync;
  readonly #statements = new Map<string, StatementSync>();

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * Opens `filePath` (decompressing `${filePath}.gz` first if the file is missing).
   * @throws If neither the file nor its archive exists.
   */
  static async open(filePath: string): Promise<SqliteDictionary> {
    const gzippedFilePath = `${filePath}.gz`;

    if (!existsSync(filePath)) {
      if (!existsSync(gzippedFilePath)) {
        throw new Error(
          `Database file not found: '${filePath}' (nor its '.gz' archive).`
        );
      }

      console.info("⏳ Unzipping database file...");
      await pipeline(
        createReadStream(gzippedFilePath),
        createGunzip(),
        createWriteStream(filePath)
      );
      console.info("✅ Database file unzipped.");
    }

    // `node:sqlite` opens URIs (SQLITE_OPEN_URI): `immutable=1` skips the locks.
    const db = new DatabaseSync(`file:${encodeURI(filePath)}?immutable=1`, {
      readOnly: true
    });

    return new SqliteDictionary(db);
  }

  /** An in-memory database (tests). */
  static memory(): SqliteDictionary {
    return new SqliteDictionary(new DatabaseSync(":memory:"));
  }

  /** The underlying connection (tests, scripts). */
  get connection(): DatabaseSync {
    return this.#db;
  }

  get preparedStatementCount(): number {
    return this.#statements.size;
  }

  /**
   * Returns the statement for `sql`, compiled once and then reused. The cache has
   * no eviction: it is meant for SQL texts built from a small, closed set of
   * fragments (never interpolate user input: bind it).
   */
  #statement(sql: string): StatementSync {
    let statement = this.#statements.get(sql);

    if (!statement) {
      statement = this.#db.prepare(sql);
      this.#statements.set(sql, statement);
    }

    return statement;
  }

  prepare(sql: string): void {
    this.#statement(sql);
  }

  // `node:sqlite` returns null-prototype objects: copied into plain objects, as D1
  // gives them (and so that `{ ...row }`, `Object.keys()` and JSON behave alike).
  all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    const rows = this.#statement(sql).all(...params) as object[];
    return Promise.resolve(rows.map((row) => ({ ...row }) as T));
  }

  get<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | undefined> {
    const row = this.#statement(sql).get(...params) as object | undefined;
    return Promise.resolve(row && ({ ...row } as T));
  }

  async batch<T>(statements: readonly SqlStatement[]): Promise<T[][]> {
    const results: T[][] = [];

    for (const { sql, params } of statements) {
      results.push(await this.all<T>(sql, params));
    }

    return results;
  }

  close(): void {
    this.#db.close();
  }
}
