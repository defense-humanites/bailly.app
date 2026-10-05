/**
 * The preview Worker's Wrangler configuration, derived from the one Nitro
 * generates for production (`.output/server/wrangler.json`, from
 * `wrangler.jsonc`): the same build (entry, assets, compatibility), deployed
 * as another Worker, on its own host (behind Cloudflare Access) and with its
 * own synchronization database, so that the `dev` branch never touches the
 * production data.
 *
 * Nitro's build redirects Wrangler to its generated configuration
 * (`.wrangler/deploy/config.json`), where Wrangler environments (`--env`) are
 * refused: hence a configuration file of its own, passed with `--config`
 * (cf. `npm run deploy:preview`).
 */
import { readFile, writeFile } from "node:fs/promises";

const PREVIEW = {
  name: "bailly-app-nuxt-preview",
  host: "pre.bailly.app",
  database: { name: "bailly-sync-preview", id: "e49c1937-0c29-44f7-914c-c7312eff1e86" },
};

const source = new URL("../.output/server/wrangler.json", import.meta.url);
const target = new URL("../.output/server/wrangler.preview.json", import.meta.url);

const config = JSON.parse(await readFile(source, "utf8"));
delete config.env;
const preview = {
  ...config,
  name: PREVIEW.name,
  // Its host only: no `workers.dev` address nor version URLs, outside of
  // the Access application.
  routes: [{ pattern: PREVIEW.host, custom_domain: true }],
  workers_dev: false,
  preview_urls: false,
  d1_databases: (config.d1_databases ?? []).map(database => database.binding === "SYNC_DB"
    ? { ...database, database_name: PREVIEW.database.name, database_id: PREVIEW.database.id }
    : database),
};
if (!preview.d1_databases.some(database => database.binding === "SYNC_DB")) {
  throw new Error("No `SYNC_DB` binding in the generated configuration.");
}
await writeFile(target, `${JSON.stringify(preview, null, 2)}\n`);
console.log(`Preview configuration written: ${PREVIEW.name} on ${PREVIEW.host}, database ${PREVIEW.database.name}.`);
