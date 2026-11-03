/**
 * Load test of the API (k6, https://k6.io: `brew install k6`), the same for Heroku
 * and the Worker: the front end's requests (`scripts/load_test/urls.ts`), at a
 * rising rate, in steps.
 *
 *   k6 run -e TARGET=https://bailly-api.antoine-boquet.workers.dev scripts/load_test/k6.js
 *   k6 run -e TARGET=https://api.bailly.app scripts/load_test/k6.js
 *
 * Options (`-e NAME=value`): `RATES` (requests per second, one step each; default
 * `5,10,20,40`), `STEP` (the length of a step; default `1m`). The test stops by
 * itself if more than 5 % of the requests fail, or if the slowest 5 % of the lookups
 * take more than 3 s (the production API must not suffer for long).
 *
 * Mix: lookups 75 %, entries 20 %, random entries 3 %, excerpt batches 2 %.
 */

import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const TARGET = __ENV.TARGET;
if (!TARGET) throw new Error("TARGET is required (the API's base URL).");

const RATES = (__ENV.RATES ?? "5,10,20,40").split(",").map(Number);
const STEP = __ENV.STEP ?? "1m";

const urls = new SharedArray("urls", () => {
  const all = JSON.parse(open("../../database/load-urls.json"));
  return [all];
})[0];

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
    "http_req_duration{kind:excerpts}": ["max>=0"]
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

  const response = http.get(`${TARGET}${path}`, {
    tags: { kind, name: kind },
    headers: { "User-Agent": "bailly-load-test" }
  });
  check(response, { "status 200": (r) => r.status === 200 });
}
