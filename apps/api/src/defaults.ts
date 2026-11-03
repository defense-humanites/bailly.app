/**
 * Defaults tied to the code, versioned with it.
 *
 * What ships with the code (the database revision) must not be chosen by the
 * environment: a config change applies immediately, to the code already running,
 * whereas a code change is deployed atomically. The environment variables remain
 * available as overrides (local development, emergencies).
 */

/**
 * Current database revision (cf. `docs/database-revisions.md`). The database is not
 * distributed with the code (`database/` is ignored by git).
 *
 * Node.js: `database/bailly-revN.db` (or its `.gz` archive, decompressed at startup,
 * cf. `SqliteDictionary.open()`). Cloudflare: the same revision is imported into the
 * D1 database bound as `DB` (cf. `wrangler.jsonc`); `version` is the only part of
 * this constant the Worker uses.
 */
export const DATABASE = {
  filePath: "database/bailly-rev4.db",
  /** Date of the source data (not of the revision). */
  version: "2023-02-28"
} as const;
