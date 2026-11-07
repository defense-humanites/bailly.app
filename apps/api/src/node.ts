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

const server = serve({ fetch: app.fetch, port: settings.port }, () => {
  console.info(
    `🐎 The API is running on port ${settings.port}...${
      settings.isDevEnv ? " (🚧 development mode)" : ""
    }`
  );
});

// A clean stop (e.g. `docker stop`, a restart of the container): no new
// connection, the requests under way finish, then the process exits (after 10 s
// at most).
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    console.info(`${signal}: stopping...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
