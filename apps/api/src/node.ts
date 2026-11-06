/**
 * Node.js entry point: the API on a plain HTTP server, with the dictionary in a
 * SQLite file and Morpheus in WebAssembly, its stem data read from the directory
 * acquired by `pnpm run morpheus:data`.
 *
 * `node src/node.ts` (Node.js 24+ runs the TypeScript sources directly).
 */

import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createNodeDependencies } from "./node/dependencies.ts";
import { Settings } from "./Settings.ts";

const settings = Settings.configure(process.env);
console.info("Current settings:", settings.summary());

const dependencies = await createNodeDependencies(settings);
const app = createApp(dependencies);

serve({ fetch: app.fetch, port: settings.port }, () => {
  console.info(
    `🐎 The API is running on port ${settings.port}...${
      settings.isDevEnv ? " (🚧 development mode)" : ""
    }`
  );
});
