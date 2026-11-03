/**
 * `Dictionary` over a Cloudflare D1 database (the `DB` binding of the Worker).
 *
 * D1 only takes positional parameters (`?1`…), which `Dictionary` requires anyway.
 * `batch()` sends every statement in one round trip: the models use it when a
 * request needs several queries (each D1 call otherwise costs a network hop).
 */

import { Settings } from "../Settings.ts";
import type { Dictionary, SqlStatement, SqlValue } from "./dictionary.ts";

export class D1Dictionary implements Dictionary {
  readonly #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  /**
   * In development, logs what each statement cost (D1 bills the rows read, index
   * entries included): `wrangler dev` with `API_ENV=development` shows it.
   */
  #trace(sql: string, { rows_read, rows_written, duration }: D1Meta): void {
    if (!Settings.getSettings().isDevEnv) return;
    const head = sql.replace(/\s+/g, " ").trim().slice(0, 72);
    console.info(
      `D1 rows_read=${rows_read} written=${rows_written} ${duration}ms  ${head}…`
    );
  }

  readonly preparedStatementCount = 0;

  prepare(): void {
    // D1 compiles the statements itself; nothing to do ahead of time.
  }

  #bind(sql: string, params: readonly SqlValue[] = []): D1PreparedStatement {
    return this.#db.prepare(sql).bind(...params);
  }

  async all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    const { results, meta } = await this.#bind(sql, params).all<T>();
    this.#trace(sql, meta);
    return results;
  }

  async get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    // `first()` gives no `meta`: `all()` with the rows it returns (a `LIMIT 1`
    // statement in practice).
    const [row] = await this.all<T>(sql, params);
    return row;
  }

  async batch<T>(statements: readonly SqlStatement[]): Promise<T[][]> {
    if (!statements.length) return [];

    const results = await this.#db.batch<T>(
      statements.map(({ sql, params }) => this.#bind(sql, params))
    );

    return results.map((result, index) => {
      this.#trace(statements[index]!.sql, result.meta);
      return result.results;
    });
  }
}
