/**
 * Cloudflare Workers entry point: the API with the dictionary in D1 (binding `DB`)
 * and Morpheus in WebAssembly, its module and its stem data bundled with the code
 * (cf. `wrangler.jsonc`).
 *
 * Workers forbid compiling WebAssembly from bytes at run time, so the `.wasm` is
 * imported as a module and the Emscripten loader statically; both are handed to the
 * binding (`wasmModule`, `factory`). Everything is initialized once per isolate, on
 * the first request (global-scope execution is capped at one second), and reused.
 *
 * Every response says, in a `Server-Timing` header, which isolate served it and
 * whether it paid for that initialization (`cold`) or waited for it (`warming`), to
 * tell the cost of the cold starts in a load test (cf. `scripts/load_test/k6.js`):
 *
 *   Server-Timing: isolate;desc="1f2e3d4c", requests;desc="1", cold
 *
 * (No durations: the clock of a Worker does not advance while it computes.)
 */

import createMorpheusModule from "@libmorpheus/wasm/module";
import wasmModule from "@libmorpheus/wasm/morpheus.wasm";
import type { Hono } from "hono";
import { createApp } from "./app.ts";
import { D1Dictionary } from "./db/d1.ts";
import { Morpheus } from "./Morpheus.ts";
import { stemlibEntries } from "./morpheus/stemlib-manifest.mjs";
import { WasmLemmatizer } from "./morpheus/wasm.ts";
import { Settings } from "./Settings.ts";

let app: Promise<Hono> | undefined;
let ready = false;

// Drawn by the first request (no random values in the global scope).
let isolate: string | undefined;
let served = 0;

async function createWorkerApp(env: Env): Promise<Hono> {
  Settings.configure(env);

  const lemmatizer = await WasmLemmatizer.create({
    module: { factory: createMorpheusModule, wasmModule },
    stemlib: () =>
      stemlibEntries.map(([path, data]) => [path, new Uint8Array(data)] as const)
  });

  return createApp({
    dictionary: new D1Dictionary(env.DB),
    morpheus: new Morpheus(lemmatizer)
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const start = app === undefined ? "cold" : ready ? "" : "warming";
    isolate ??= crypto.randomUUID().slice(0, 8);

    app ??= createWorkerApp(env).then(
      (created) => {
        ready = true;
        return created;
      },
      (error) => {
        // A failed initialization is retried by the next request.
        app = undefined;
        throw error;
      }
    );

    const response = await (await app).fetch(request, env, ctx);

    // A copy: the headers of a response may be immutable.
    const timed = new Response(response.body, response);
    timed.headers.append(
      "Server-Timing",
      `isolate;desc="${isolate}", requests;desc="${++served}"${start ? `, ${start}` : ""}`
    );
    return timed;
  }
} satisfies ExportedHandler<Env>;
