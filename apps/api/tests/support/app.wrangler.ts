/**
 * The application under test in the Workers runtime (`#test-app` of the `workers`
 * Vitest project): the Worker itself (`src/worker.ts`, bundled by Wrangler with the
 * WebAssembly module and the stem data), served by `wrangler dev` with the local D1
 * database (`pnpm run d1:local`), and reached over HTTP. `tests/support/wrangler.ts`
 * starts it before the suite and provides its address.
 *
 * `app.request()` mirrors Hono's: a path (or a `Request`) and an optional `init`.
 */

import { inject } from "vitest";
import { Settings } from "../../src/Settings.ts";
import { TEST_ENVIRONMENT } from "./environment.ts";

// The Worker has its own settings (the `vars` of `wrangler.jsonc`); these only serve
// the tests that read them (e.g. the allowed fields).
Settings.configure(TEST_ENVIRONMENT);

const baseUrl = inject("workerUrl");

export const app = {
  request(input: string | Request, init?: RequestInit): Promise<Response> {
    const request = typeof input === "string" ? new Request(new URL(input, baseUrl), init) : input;
    return fetch(request);
  }
};

export const morpheusAvailable = true;

/** D1 compiles its statements itself: the statement cache tests are skipped. */
export const dictionary = { preparedStatementCount: 0 };
