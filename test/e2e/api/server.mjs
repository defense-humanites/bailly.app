/**
 * A stand-in for the Bailly API, for the end-to-end tests: it replays the
 * responses recorded from `api.bailly.app` (real data) in `fixtures.json`, so
 * that the tests are deterministic and need no network.
 *
 * - `PORT`: the port to listen to (default: 4010).
 * - `E2E_API_RECORD=1`: record mode; a request without a fixture is relayed to
 *   `E2E_API_ORIGIN` (default: `https://api.bailly.app`), and its response saved
 *   (behind a proxy, also set `NODE_USE_ENV_PROXY=1`). Otherwise, such a
 *   request gets a 404 (and a warning).
 */
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";

const port = Number(process.env.PORT ?? 4010);
const record = process.env.E2E_API_RECORD === "1";
const origin = process.env.E2E_API_ORIGIN ?? "https://api.bailly.app";
const fixturesFile = new URL("./fixtures.json", import.meta.url);

/** @type {Record<string, unknown>} */
let fixtures = {};
try {
  fixtures = JSON.parse(readFileSync(fixturesFile, "utf8"));
} catch {
  // No fixtures yet.
}

/**
 * The fixture key of a request: its decoded path and its sorted query.
 * @param {URL} url
 */
const keyOf = (url) => {
  // Without a random draw's number (cf. `RandomOpening`), which the API ignores.
  const params = [...url.searchParams].filter(([name]) => name !== "draw").sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return decodeURIComponent(url.pathname) + (query ? `?${decodeURIComponent(query)}` : "");
};

const save = () => {
  const sorted = Object.fromEntries(Object.entries(fixtures).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(fixturesFile, `${JSON.stringify(sorted, null, 1)}\n`);
};

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/health") {
    res.end("{}");
    return;
  }

  const key = keyOf(url);
  if (!(key in fixtures) && record) {
    const response = await fetch(origin + url.pathname + url.search);
    fixtures[key] = response.ok ? await response.json() : null;
    save();
    console.log(`[api] recorded ${key}`);
  }

  if (fixtures[key] == null) {
    if (!record) console.warn(`[api] no fixture for ${key}`);
    res.statusCode = 404;
    res.end("{}");
    return;
  }
  res.end(JSON.stringify(fixtures[key]));
}).listen(port, () => console.log(`[api] ${record ? "recording" : "replaying"} on :${port}`));
