/**
 * The dictionary database, as the models see it: a read-only SQLite database
 * (`bailly` table), behind an asynchronous interface that both SQLite (Node.js,
 * `node:sqlite`) and Cloudflare D1 implement.
 *
 * Parameters are positional (`?1`, `?2`…; a parameter can be repeated by its number)
 * because D1 has no named parameters. Rows are plain objects, one property per
 * selected column.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;

export type SqlStatement = {
  sql: string;
  params?: readonly SqlValue[];
};

export interface Dictionary {
  /** The rows of a statement. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  /** The first row of a statement, `undefined` if there is none. */
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined>;

  /**
   * The rows of several statements, run together (D1: a single round trip).
   * The results come in the order of the statements.
   */
  batch<T>(statements: readonly SqlStatement[]): Promise<T[][]>;

  /**
   * Compiles a statement ahead of time, where that means something (SQLite:
   * cf. `preloadLookupStatements()`). A no-op elsewhere.
   */
  prepare(sql: string): void;

  /** Number of statements compiled by `prepare()` (and by the queries), if known. */
  readonly preparedStatementCount: number;
}
