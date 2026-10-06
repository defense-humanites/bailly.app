/**
 * The preview Worker's Wrangler configuration, derived from the one Nitro
 * generates for production (`.output/server/wrangler.json`, from
 * `wrangler.jsonc`): the same build (entry, assets, compatibility), deployed
 * as another Worker, on its `workers.dev` address (no custom domain: a
 * deployment with the production's configuration once took `bailly.app`
 * over) and with its own synchronization database, so that the `dev` branch
 * never touches the production data.
 *
 * Nitro's build redirects Wrangler to its generated configuration
 * (`.wrangler/deploy/config.json`), where Wrangler environments (`--env`) are
 * refused: hence a configuration of its own.
 *
 * - `node scripts/wrangler-preview.mjs`: written beside the generated one
 *   (`wrangler.preview.json`), deployed with `--config` (cf. `npm run
 *   deploy:preview`).
 * - `--from-build` (cf. `npm run build`): a safeguard. Built by Workers
 *   Builds from another branch than `main` (`WORKERS_CI_BRANCH`), the
 *   generated configuration itself becomes the preview's: whatever the
 *   deploy command (Workers Builds' default `npx wrangler deploy` included),
 *   a build of `dev` can't be deployed with the production's domain and
 *   database. Elsewhere (production, local builds), nothing changes.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const PREVIEW = {
  name: "bailly-app-nuxt-preview",
  database: { name: "bailly-sync-preview", id: "3a15b6aa-d242-42e2-9993-2506b780879d" },
};

/** The branch of production: its builds keep the generated configuration. */
const PRODUCTION_BRANCH = "main";

const source = new URL("../.output/server/wrangler.json", import.meta.url);
const fromBuild = process.argv.includes("--from-build");

if (fromBuild) {
  const branch = process.env.WORKERS_CI_BRANCH;
  // Not a Cloudflare build (no generated configuration), not Workers
  // Builds, or the production's branch: nothing to do.
  if (!existsSync(source) || !process.env.WORKERS_CI || !branch || branch === PRODUCTION_BRANCH) process.exit(0);
}

const config = JSON.parse(await readFile(source, "utf8"));
delete config.env;
const preview = {
  ...config,
  name: PREVIEW.name,
  // Its `workers.dev` address only: no route nor custom domain (never the
  // production's), no version URLs.
  routes: [],
  workers_dev: true,
  preview_urls: false,
  d1_databases: (config.d1_databases ?? []).map(database => database.binding === "SYNC_DB"
    ? { ...database, database_name: PREVIEW.database.name, database_id: PREVIEW.database.id }
    : database),
};
if (!preview.d1_databases.some(database => database.binding === "SYNC_DB")) {
  throw new Error("No `SYNC_DB` binding in the generated configuration.");
}
const target = fromBuild ? source : new URL("../.output/server/wrangler.preview.json", import.meta.url);
await writeFile(target, `${JSON.stringify(preview, null, 2)}\n`);
console.log(`Preview configuration written${fromBuild ? ` for the branch ${process.env.WORKERS_CI_BRANCH} (in place of the production's)` : ""}: ${PREVIEW.name} on workers.dev, database ${PREVIEW.database.name}.`);
