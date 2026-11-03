/**
 * Defaults tied to the code, versioned with it.
 *
 * What ships with the code (the database revision) must not be chosen by the
 * environment: a config change applies immediately, to the code already running,
 * whereas a code change is deployed atomically. The environment variables remain
 * available as overrides (local development, emergencies).
 */

/**
 * Current database revision (cf. `database/REVISION_HISTORY.md`).
 *
 * Node.js: the `.gz` archive is decompressed at startup if needed (cf.
 * `SqliteDictionary.open()`). Cloudflare: the same revision is imported into the D1
 * database bound as `DB` (cf. `wrangler.jsonc`); `version` is the only part of this
 * constant the Worker uses.
 *
 * To deploy a new revision: put `database/bailly-revN.db`, update this constant, run
 * `npm run db:pack`, commit the `.gz` archive, then push: code and data are deployed
 * together. `tests/database.test.ts` fails if the archive is missing or untracked.
 */
export const DATABASE = {
  filePath: "database/bailly-rev4.db",
  /** Date of the source data (not of the revision). */
  version: "2023-02-28"
} as const;
