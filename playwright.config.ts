import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import type { ConfigOptions } from "@nuxt/test-utils/playwright";

/**
 * End-to-end tests (`test/e2e`), with the Nuxt integration of Playwright
 * (`goto(url, { waitUntil: "hydration" })`).
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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
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
          env: { PORT: String(appPort), NUXT_PUBLIC_API_HOST: `http://127.0.0.1:${apiPort}` },
          timeout: 300_000,
          reuseExistingServer: !ci,
        }]),
  ],
});
