/**
 * Global setup of the `workers` Vitest project: starts the Worker with
 * `wrangler dev` (local D1 of `.wrangler/state/v3/`, cf. `npm run d1:local`), waits
 * for it to answer, and provides its address to the tests (`inject("workerUrl")`).
 */

import { spawn } from "node:child_process";
// `URL` from Node.js: the global one is typed by the Workers types here.
import { fileURLToPath, URL } from "node:url";
import type { TestProject } from "vitest/node";
import { TEST_ENVIRONMENT } from "./environment.ts";

declare module "vitest" {
  export interface ProvidedContext {
    workerUrl: string;
  }
}

const PORT = 8790;
const STARTUP_TIMEOUT = 60_000;

export default async function setup(project: TestProject): Promise<() => void> {
  const url = `http://127.0.0.1:${PORT}/`;

  const wrangler = spawn(
    fileURLToPath(new URL("../../node_modules/.bin/wrangler", import.meta.url)),
    [
      "dev",
      "--port",
      String(PORT),
      "--local",
      "--show-interactive-dev-session=false",
      // The settings of the tests, over the `vars` of `wrangler.jsonc`.
      ...Object.entries(TEST_ENVIRONMENT).flatMap(([key, value]) => [
        "--var",
        `${key}:${value}`
      ])
    ],
    // Its own process group: Wrangler spawns workerd; all of them are stopped
    // together at teardown.
    {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" }
    }
  );

  let output = "";
  wrangler.stdout.on("data", (chunk: Buffer) => (output += chunk));
  wrangler.stderr.on("data", (chunk: Buffer) => (output += chunk));

  const deadline = Date.now() + STARTUP_TIMEOUT;

  while (true) {
    if (wrangler.exitCode !== null) {
      throw new Error(`wrangler dev exited (${wrangler.exitCode}):\n${output}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      stop();
      throw new Error(`wrangler dev did not answer within ${STARTUP_TIMEOUT} ms:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  project.provide("workerUrl", url);

  return stop;

  function stop(): void {
    try {
      if (wrangler.pid) process.kill(-wrangler.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}
