/**
 * Cloudflare Workers entry point: the API with the dictionary in D1 (binding `DB`)
 * and Morpheus in WebAssembly, its module and its stem data bundled with the code
 * (cf. `wrangler.jsonc`).
 *
 * Workers forbid compiling WebAssembly from bytes at run time, so the `.wasm` is
 * imported as a module and the Emscripten loader statically; both are handed to the
 * binding (`wasmModule`, `factory`). Everything is initialized once per isolate, on
 * the first request (global-scope execution is capped at one second), and reused.
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
    app ??= createWorkerApp(env).catch((error) => {
      // A failed initialization is retried by the next request.
      app = undefined;
      throw error;
    });

    return (await app).fetch(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
