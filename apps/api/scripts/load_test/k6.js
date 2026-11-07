/**
 * Load test of the API (k6, https://k6.io: `brew install k6`), for any deployment of
 * it: the front end's requests (`scripts/load_test/urls.ts`), at a rising rate, in
 * steps. Only against a deployment one is responsible for.
 *
 *   k6 run -e TARGET=<URL> scripts/load_test/k6.js
 *
 * Options (`-e NAME=value`): `RATES` (requests per second, one step each; default
 * `5,10,20,40`), `STEP` (the length of a step; default `1m`), `CACHE` (cf. below). The test stops by
 * itself if more than 5 % of the requests fail, or if the slowest 5 % of the lookups
 * take more than 3 s (the production API must not suffer for long).
 *
 * Mix: lookups 75 %, entries 20 %, random entries 3 %, excerpt batches 2 %.
 *
 * By default, the Worker itself is measured: each request carries a random `k6`
 * parameter, which makes it unique, so that the Worker's cache never serves it. With
 * `CACHE=1`, the requests are sent as the front end sends them, and the cache is part
 * of the measure (`cache_hits`: the share served by it, which tell no isolate).
 *
 * Against the Worker, its `Server-Timing` header (cf. `src/worker.ts`; requested by the
 * `Bailly-Diagnostics` header) sorts the requests it ran: `cold_starts`, the share that started an isolate (their number is that of
 * the isolates), and the durations of the requests that started one (`cold`) or found
 * it ready (`warm`), by kind of request;
 * `morpheus_starts` and `morpheus_req_duration`, the requests that instantiated
 * Morpheus (on their isolate's first analysis).
 */

import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";

const TARGET = __ENV.TARGET;
if (!TARGET) throw new Error("TARGET is required (the API's base URL).");

const RATES = (__ENV.RATES ?? "5,10,20,40").split(",").map(Number);
const STEP = __ENV.STEP ?? "1m";
const CACHE = Boolean(__ENV.CACHE);

const urls = new SharedArray("urls", () => {
  const all = JSON.parse(open("../../database/load-urls.json"));
  return [all];
})[0];

const cacheHits = new Rate("cache_hits");
const coldStarts = new Rate("cold_starts");
const morpheusStarts = new Rate("morpheus_starts");
const morpheusDuration = new Trend("morpheus_req_duration", true);
const durations = {
  cold: new Trend("cold_req_duration", true),
  warm: new Trend("warm_req_duration", true)
};

const MIX = [
  ["lookup", 0.75],
  ["entry", 0.2],
  ["random", 0.03],
  ["excerpts", 0.02]
];

export const options = {
  discardResponseBodies: true,
  scenarios: {
    steps: {
      executor: "ramping-arrival-rate",
      startRate: RATES[0],
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 400,
      // Each step: 10 s to reach the rate, then the step at that rate.
      stages: RATES.flatMap((rate) => [
        { target: rate, duration: "10s" },
        { target: rate, duration: STEP }
      ])
    }
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "20s" }],
    "http_req_duration{kind:lookup}": [
      { threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "20s" }
    ],
    // Reported by kind (no limit).
    "http_req_duration{kind:entry}": ["max>=0"],
    "http_req_duration{kind:random}": ["max>=0"],
    "http_req_duration{kind:excerpts}": ["max>=0"],
    // The cold starts by kind (Morpheus is only instantiated by a lookup).
    "cold_req_duration{kind:lookup}": ["max>=0"],
    "cold_req_duration{kind:entry}": ["max>=0"]
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"]
};

function pick() {
  let draw = Math.random();
  for (const [kind, share] of MIX) {
    if ((draw -= share) < 0) return kind;
  }
  return "lookup";
}

export default function () {
  const kind = pick();
  const list = urls[kind];
  let path = list[Math.floor(Math.random() * list.length)];
  // A new draw each time, as on the home page.
  if (kind === "random") path += `&draw=${Math.floor(Math.random() * 1e9)}`;
  // Out of the cache's reach (a key of its own).
  if (!CACHE) path += `${path.includes("?") ? "&" : "?"}k6=${Math.floor(Math.random() * 1e9)}`;

  const response = http.get(`${TARGET}${path}`, {
    tags: { kind, name: kind },
    headers: { "User-Agent": "bailly-load-test", "Bailly-Diagnostics": "1" }
  });
  check(response, { "status 200": (r) => r.status === 200 });

  const timing = response.headers["Server-Timing"] ?? "";
  // Without diagnostics, the response came from the cache (the Worker did not run).
  cacheHits.add(!timing.includes("isolate"));
  if (timing.includes("isolate")) {
    const start = /\bcold\b/.test(timing) ? "cold" : "warm";
    coldStarts.add(start === "cold");
    durations[start].add(response.timings.duration, { kind });
    const morpheus = /\bmorpheus\b/.test(timing);
    morpheusStarts.add(morpheus);
    if (morpheus) morpheusDuration.add(response.timings.duration, { kind });
  }
}
