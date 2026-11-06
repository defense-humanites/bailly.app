// `URL` from Node.js: the global one is typed by the Workers types here.
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * The same suite runs on two platforms (`#test-app` resolves to one application or
 * the other, cf. `tests/support/`):
 *
 *   - `node` (`pnpm test`): the application in-process on Node.js, with the SQLite
 *     file and Morpheus reading the stem data from `morpheus-data/`;
 *   - `workers` (`pnpm run test:workers`): the Worker (`src/worker.ts`) served by
 *     `wrangler dev` in the Workers runtime, with the local D1 database (cf.
 *     `pnpm run d1:local`) and the bundled stem data, reached over HTTP. Not run by
 *     default: it needs the local D1 import.
 */

const support = (file: string) =>
  fileURLToPath(new URL(`./tests/support/${file}`, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.test.ts"],
          testTimeout: 30_000
        },
        resolve: {
          alias: { "#test-app": support("app.node.ts") }
        }
      },
      {
        test: {
          name: "workers",
          include: ["tests/**/*.test.ts"],
          // Node.js only (git, file system).
          exclude: ["tests/database.test.ts"],
          globalSetup: [support("wrangler.ts")],
          testTimeout: 30_000
        },
        resolve: {
          alias: { "#test-app": support("app.wrangler.ts") }
        }
      }
    ]
  }
});
