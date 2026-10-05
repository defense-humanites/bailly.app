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
 * refused: hence a configuration file of its own, passed with `--config`
 * (cf. `npm run deploy:preview`).
 */
import { readFile, writeFile } from "node:fs/promises";

const PREVIEW = {
  name: "bailly-app-nuxt-preview",
  database: { name: "bailly-sync-preview", id: "3a15b6aa-d242-42e2-9993-2506b780879d" },
};

const source = new URL("../.output/server/wrangler.json", import.meta.url);
const target = new URL("../.output/server/wrangler.preview.json", import.meta.url);

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
await writeFile(target, `${JSON.stringify(preview, null, 2)}\n`);
console.log(`Preview configuration written: ${PREVIEW.name} on workers.dev, database ${PREVIEW.database.name}.`);
