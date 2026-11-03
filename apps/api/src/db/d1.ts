/**
 * `Dictionary` over a Cloudflare D1 database (the `DB` binding of the Worker).
 *
 * D1 only takes positional parameters (`?1`…), which `Dictionary` requires anyway.
 * `batch()` sends every statement in one round trip: the models use it when a
 * request needs several queries (each D1 call otherwise costs a network hop).
 */

import type { Dictionary, SqlStatement, SqlValue } from "./dictionary.ts";

export class D1Dictionary implements Dictionary {
  readonly #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  readonly preparedStatementCount = 0;

  prepare(): void {
    // D1 compiles the statements itself; nothing to do ahead of time.
  }

  #bind(sql: string, params: readonly SqlValue[] = []): D1PreparedStatement {
    return this.#db.prepare(sql).bind(...params);
  }

  async all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    const { results } = await this.#bind(sql, params).all<T>();
    return results;
  }

  async get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    return (await this.#bind(sql, params).first<T>()) ?? undefined;
  }

  async batch<T>(statements: readonly SqlStatement[]): Promise<T[][]> {
    if (!statements.length) return [];

    const results = await this.#db.batch<T>(
      statements.map(({ sql, params }) => this.#bind(sql, params))
    );

    return results.map((result) => result.results);
  }
}
