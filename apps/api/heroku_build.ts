/**
 * Heroku build step, run by the Deno buildpack (chibat/heroku-buildpack-deno) from the
 * app directory, whose content is then copied into the slug.
 *
 * Installs libmorpheus (native library for Linux x86-64 glibc, SHA-256 verified) and
 * the Alpheios stem dataset, the one embedded in the `morpheus-deno` development
 * image. The version follows the `@libmorpheus/deno` binding pinned by `deno.lock`.
 *
 * The install paths (`src/defaults.ts`) are the API's defaults: no config var needed.
 *
 * NB: the buildpack ignores the exit code of this script (`set +e`); a failed install
 * is caught by the release phase (`scripts/heroku_release.ts`), which prevents the
 * deployment.
 */

import { setupMorpheus } from "@libmorpheus/deno/setup";
import { MORPHEUS_VENDOR } from "./src/defaults.ts";

const { nativeOutput: NATIVE_OUTPUT, dataOutput: DATA_OUTPUT } = MORPHEUS_VENDOR;

try {
  // `setupMorpheus()` refuses to overwrite existing directories.
  for (const path of [NATIVE_OUTPUT, DATA_OUTPUT]) {
    await Deno.remove(path, { recursive: true }).catch((error) => {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    });
  }

  // … but needs their parent directory.
  await Deno.mkdir("vendor", { recursive: true });

  const receipt = await setupMorpheus({
    dataset: "alpheios",
    nativeOutput: NATIVE_OUTPUT,
    dataOutput: DATA_OUTPUT
  });

  // The API loads the library from `MORPHEUS_VENDOR.libraryPath` by default.
  const expected = await Deno.realPath(MORPHEUS_VENDOR.libraryPath);
  if ((await Deno.realPath(receipt.nativeLibraryPath)) !== expected) {
    throw new Error(
      `library installed at ${receipt.nativeLibraryPath}, expected ${expected}`
    );
  }

  console.info("-----> libmorpheus installed:", {
    nativeLibraryPath: receipt.nativeLibraryPath,
    dataOutput: receipt.dataOutput
  });
} catch (error) {
  console.error("-----> ❌ libmorpheus installation FAILED:", error);
  Deno.exit(1);
}
