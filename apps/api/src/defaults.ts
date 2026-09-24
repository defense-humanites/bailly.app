/**
 * Defaults tied to the code, versioned with it.
 *
 * What ships in the repository (the database revision) or is installed by the build
 * (libmorpheus, cf. `heroku_build.ts`) must not be chosen by the environment: a config
 * change applies immediately, to the code already running (on Heroku, it restarts the
 * current release), whereas a code change is deployed atomically, after the release
 * phase. The environment variables remain available as overrides (local development,
 * Docker, emergencies).
 */

/**
 * Current database revision (cf. `database/REVISION_HISTORY.md`). The `.gz` archive is
 * decompressed at startup if needed (cf. `Database.getConnection()`).
 *
 * To deploy a new revision: put `database/bailly-revN.db`, update this constant (and
 * `.slugignore`, which keeps only the current archive in the Heroku slug), run
 * `deno task db:pack`, commit the `.gz` archive, then push: code and data are deployed
 * together. `tests/database.test.ts` fails if the archive is missing or untracked.
 */
export const DATABASE = {
  filePath: "database/bailly-rev4.db",
  /** Date of the source data (not of the revision). */
  version: "2023-02-28"
} as const;

/** libmorpheus, as installed by `heroku_build.ts`. */
export const MORPHEUS_VENDOR = {
  nativeOutput: "vendor/morpheus-native",
  dataOutput: "vendor/morpheus-data",
  libraryPath: "vendor/morpheus-native/lib/libmorpheus.so"
} as const;
