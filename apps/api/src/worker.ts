/**
 * Cloudflare Workers entry point: the API with the dictionary in D1 (binding `DB`)
 * and Morpheus in WebAssembly, its module and its stem data bundled with the code
 * (cf. `wrangler.jsonc`).
 *
 * Workers forbid compiling WebAssembly from bytes at run time, so the `.wasm` is
 * imported as a module and the Emscripten loader statically; both are handed to the
 * binding (`wasmModule`, `factory`). The application is created once per isolate, on
 * the first request (global-scope execution is capped at one second), and reused;
 * Morpheus is only instantiated by the first request that analyzes a form (a
 * lookup): the others (entries, random entries, excerpts) never wait for it.
 *
 * A request with a `Bailly-Diagnostics` header learns, in a `Server-Timing` header,
 * which isolate served it, whether it was the isolate's first request (`cold`), and
 * whether it instantiated Morpheus (`morpheus`), to tell the cost of the cold starts
 * in a load test (cf. `scripts/load_test/k6.js`):
 *
 *   Server-Timing: isolate;desc="1f2e3d4c", requests;desc="1", cold, morpheus
 *
 * (No durations: the clock of a Worker does not advance while it computes.) Such a
 * response is never stored by the Worker's cache (`Cache-Control: no-store`): the
 * others must not be given its diagnostics. A response served by the cache does not
 * run the Worker, and has none.
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

// Created synchronously by the first request: no promise of one request awaited by
// another (cf. `Shared`).
let app: Hono | undefined;

// Drawn by the first request (no random values in the global scope).
let isolate: string | undefined;
let served = 0;
let lemmatizer: WasmLemmatizer | undefined;

function createWorkerApp(env: Env): Hono {
  Settings.configure(env);

  lemmatizer = WasmLemmatizer.lazy({
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
    const start = app === undefined ? "cold" : "";
    const instantiations = lemmatizer?.instantiations ?? 0;
    isolate ??= crypto.randomUUID().slice(0, 8);

    app ??= createWorkerApp(env);

    const response = await app.fetch(request, env, ctx);
    if (!request.headers.has("Bailly-Diagnostics")) return response;

    // A copy: the headers of a response may be immutable.
    const timed = new Response(response.body, response);
    timed.headers.set("Cache-Control", "no-store");
    // (Approximate if concurrent requests of the isolate overlap the instantiation.)
    const morpheus = (lemmatizer?.instantiations ?? 0) > instantiations;
    timed.headers.append(
      "Server-Timing",
      `isolate;desc="${isolate}", requests;desc="${++served}"` +
        `${start ? `, ${start}` : ""}${morpheus ? ", morpheus" : ""}`
    );
    return timed;
  }
} satisfies ExportedHandler<Env>;
