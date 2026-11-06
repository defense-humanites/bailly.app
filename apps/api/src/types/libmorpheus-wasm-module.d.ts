// The Emscripten loader of `@libmorpheus/wasm` (`dist/morpheus.mjs`), which the
// package exports without types: its default export is the module factory that
// `createMorpheus({ factory })` takes (cf. `CreateMorpheusOptions`).
declare module "@libmorpheus/wasm/module" {
  import type { CreateMorpheusOptions } from "@libmorpheus/wasm";

  const createMorpheusModule: NonNullable<CreateMorpheusOptions["factory"]>;
  export default createMorpheusModule;
}
