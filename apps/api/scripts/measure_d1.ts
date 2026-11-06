/**
 * Measures what the requests of the load test (`database/load-urls.json`, cf.
 * `scripts/load_test/urls.ts`) cost on D1: round trips (one per `batch()`, `all()` or
 * `get()`) and rows read (`meta.rows_read`, what D1 bills), by kind of request. Runs
 * the models against the *local* D1 database (`pnpm run d1:local`), through
 * Wrangler's platform proxy: the same engine as the hosted one, without the network.
 *
 * Usage: node scripts/measure_d1.ts
 *
 * Details: `DETAIL=lookup` (or `entry`…) prints each request of that kind with its
 * rows read and round trips; `STATEMENTS=1`, each statement of a batch.
 */

import { readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";
import type { Dictionary, SqlStatement, SqlValue } from "../src/db/dictionary.ts";
import type { QueryableFields } from "../src/definitions.ts";
import { setParams } from "../src/helpers.ts";
import { getEntry } from "../src/model/entry.ts";
import { getExcerpts, parseExcerptsUris } from "../src/model/excerpts.ts";
import { getEntries } from "../src/model/lookup.ts";
import { getRandomEntry } from "../src/model/randomEntry.ts";
import { createNodeMorpheus } from "../src/node/dependencies.ts";
import { Settings } from "../src/Settings.ts";

// The settings of the Worker (`vars` of `wrangler.jsonc`).
const proxy = await getPlatformProxy<{ DB: D1Database } & Record<string, string>>({
  persist: true
});
const settings = Settings.configure({ ...proxy.env, API_ENV: "production" });

/** Counts the round trips and the rows read (D1 gives them in `meta`). */
class MeasuredD1 implements Dictionary {
  readonly preparedStatementCount = 0;
  roundTrips = 0;
  rowsRead = 0;
  readonly #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  prepare(): void {}

  async all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    this.roundTrips++;
    const { results, meta } = await this.#db.prepare(sql).bind(...params).all<T>();
    this.rowsRead += meta.rows_read;
    return results;
  }

  async get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | undefined> {
    return (await this.all<T>(sql, params))[0];
  }

  async batch<T>(statements: readonly SqlStatement[]): Promise<T[][]> {
    if (!statements.length) return [];
    this.roundTrips++;
    const results = await this.#db.batch<T>(
      statements.map(({ sql, params }) => this.#db.prepare(sql).bind(...(params ?? [])))
    );
    return results.map(({ results, meta }, i) => {
      this.rowsRead += meta.rows_read;
      if (process.env.STATEMENTS) {
        console.log(`STATEMENT ${meta.rows_read} rows, ${results.length} results: ${statements[i]!.sql.replace(/\s+/g, " ").slice(0, 160)}`);
      }
      return results;
    });
  }
}

const db = new MeasuredD1(proxy.env.DB);
const morpheus = await createNodeMorpheus(settings);

const urls = JSON.parse(readFileSync("database/load-urls.json", "utf8")) as Record<
  string,
  string[]
>;

type Fields = keyof QueryableFields;

/** Runs a request of the test against the models, as the routes of `app.ts` do. */
async function run(path: string): Promise<void> {
  const url = new URL(path, "http://localhost");
  const query = Object.fromEntries(url.searchParams);

  if (url.pathname.startsWith("/lookup/")) {
    const q = decodeURIComponent(url.pathname.slice("/lookup/".length));
    await getEntries(db, morpheus, setParams({ ...query, q }) as never);
  } else if (url.pathname === "/entry/random") {
    const params = setParams<Record<string, unknown>>({ ...query });
    delete params.q;
    await getRandomEntry(db, params as never);
  } else if (url.pathname.startsWith("/entry/")) {
    const q = decodeURIComponent(url.pathname.slice("/entry/".length));
    await getEntry<Fields, Fields>(db, setParams({ ...query, q }) as never);
  } else if (url.pathname === "/entries/excerpts") {
    await getExcerpts(db, parseExcerptsUris(query.uris ?? ""));
  }
}

// The derived data, read once per isolate: out of the measures.
await run(urls.lookup![0]!);

const kinds: [string, string[]][] = [
  ["lookup", urls.lookup!],
  ["entry", urls.entry!],
  ["random", Array(100).fill(urls.random![0])],
  ["excerpts", urls.excerpts!]
];

const MIX: Record<string, number> = { lookup: 0.75, entry: 0.2, random: 0.03, excerpts: 0.02 };
let mixedTrips = 0;
let mixedRows = 0;

for (const [kind, paths] of kinds) {
  const trips: number[] = [];
  let rows = 0;
  for (const path of paths) {
    db.roundTrips = 0;
    db.rowsRead = 0;
    await run(path);
    trips.push(db.roundTrips);
    rows += db.rowsRead;
    if (process.env.DETAIL === kind) {
      console.log(`DETAIL ${db.rowsRead} ${db.roundTrips} ${decodeURIComponent(path.split("?")[0]!)}`);
    }
  }
  const histogram = Object.entries(
    trips.reduce<Record<number, number>>((h, n) => ((h[n] = (h[n] ?? 0) + 1), h), {})
  ).map(([n, count]) => `${n}×${count}`).join(" ");
  const meanTrips = trips.reduce((a, b) => a + b, 0) / trips.length;
  mixedTrips += MIX[kind]! * meanTrips;
  mixedRows += MIX[kind]! * (rows / paths.length);
  console.info(
    `${kind.padEnd(9)} ${paths.length} requests: round trips ${meanTrips.toFixed(2)} ` +
      `(${histogram}), rows read ${(rows / paths.length).toFixed(1)} per request`
  );
}

console.info(
  `mix (75/20/3/2): round trips ${mixedTrips.toFixed(2)}, rows read ${mixedRows.toFixed(1)} per request`
);

await proxy.dispose();
