import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import type { ConfigOptions } from "@nuxt/test-utils/playwright";

/**
 * End-to-end tests (`test/e2e`), with the Nuxt integration of Playwright
 * (`goto(url, { waitUntil: "hydration" })`), on Chromium.
 *
 * The app talks to a stand-in API replaying real responses
 * (`test/e2e/api/server.mjs`). By default, the app is built and served for
 * the tests; set `E2E_BASE_URL` to test a running server instead (e.g. a dev
 * server started with `NUXT_PUBLIC_API_HOST=http://127.0.0.1:4010`).
 */
const apiPort = 4010;
const appPort = 4020;
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${appPort}`;
const ci = !!process.env.CI;

export default defineConfig<ConfigOptions>({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    nuxt: {
      rootDir: fileURLToPath(new URL(".", import.meta.url)),
      host: baseURL,
    },
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  // Chromium only: the fine visual checks, on the other browsers and on
  // mobile devices, are done by hand.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Another Chromium than Playwright's own, if needed (e.g. the one
        // preinstalled in Claude's cloud workspace).
        launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH },
      },
    },
  ],
  webServer: [
    {
      command: "node test/e2e/api/server.mjs",
      url: `http://127.0.0.1:${apiPort}/health`,
      env: { PORT: String(apiPort) },
      reuseExistingServer: !ci,
    },
    ...(process.env.E2E_BASE_URL
      ? []
      : [{
          command: "nuxt build && node .output/server/index.mjs",
          url: baseURL,
          // No daily budget for the synchronization: all the tests come from
          // one address (cf. `server/lib/syncBudget.ts`, tested on its own).
          env: {
            PORT: String(appPort),
            NUXT_PUBLIC_API_HOST: `http://127.0.0.1:${apiPort}`,
            NUXT_SYNC_DAILY_BYTES: "0",
            NUXT_SYNC_DAILY_CREATIONS: "0",
            NUXT_SYNC_DAILY_GROWTH: "0",
          },
          timeout: 300_000,
          reuseExistingServer: !ci,
        }]),
  ],
});
