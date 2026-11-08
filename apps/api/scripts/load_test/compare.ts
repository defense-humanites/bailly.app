/**
 * Compares the responses of two deployments of the API (e.g. Heroku and the Worker)
 * on the requests of the load test (`database/load-urls.json`, cf. `urls.ts`), random
 * entries excepted, and prints the differing paths. Sequential (one request at a
 * time to each API): not a load. The `$query` of the responses (the parameters as
 * the API read them, a diagnosis) is left out of the comparison.
 *
 * Usage: node scripts/load_test/compare.ts <base URL A> <base URL B> [sample size]
 */

import { readFileSync } from "node:fs";

const [baseA, baseB, size = "300"] = process.argv.slice(2);
if (!baseA || !baseB) {
  console.error("Usage: node scripts/load_test/compare.ts <base URL A> <base URL B> [sample size]");
  process.exit(1);
}

const urls = JSON.parse(readFileSync("database/load-urls.json", "utf8")) as Record<
  string,
  string[]
>;

const sample = (list: string[], count: number) =>
  [...list].sort(() => Math.random() - 0.5).slice(0, count);

const total = Number(size);
const paths = [
  ...sample(urls.lookup!, Math.round(total * 0.75)),
  ...sample(urls.entry!, Math.round(total * 0.2)),
  ...sample(urls.excerpts!, Math.round(total * 0.05))
];

const fetchJson = async (base: string, path: string) => {
  const start = performance.now();
  const response = await fetch(`${base}${path}`, {
    headers: { "User-Agent": "bailly-load-test" }
  });
  const text = await response.text();
  let body = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.data?.$query) delete parsed.data.$query;
    body = JSON.stringify(parsed);
  } catch {
    // Not JSON: compared as it is.
  }
  return { status: response.status, body, time: performance.now() - start };
};

const differences: string[] = [];
const times = { a: [] as number[], b: [] as number[] };

for (const [index, path] of paths.entries()) {
  const [a, b] = await Promise.all([fetchJson(baseA, path), fetchJson(baseB, path)]);
  times.a.push(a.time);
  times.b.push(b.time);

  if (a.status !== b.status || a.body !== b.body) {
    differences.push(path);
    if (differences.length <= 5) {
      console.error(
        `❌ ${decodeURIComponent(path)}\n   A ${a.status}: ${a.body.slice(0, 300)}\n` +
          `   B ${b.status}: ${b.body.slice(0, 300)}`
      );
    }
  }
  if ((index + 1) % 50 === 0) {
    console.info(`  ${index + 1}/${paths.length}, ${differences.length} differences`);
  }
}

const median = (values: number[]) =>
  [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)]!.toFixed(0);

console.info(
  `${paths.length} requests, ${differences.length} differences; ` +
    `median time A ${median(times.a)} ms, B ${median(times.b)} ms (one at a time).`
);
for (const path of differences.slice(0, 50)) console.info(`  ${decodeURIComponent(path)}`);
process.exit(differences.length ? 1 : 0);
