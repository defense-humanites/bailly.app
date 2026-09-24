import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

export default defineConfig({
  test: {
    // `test/nuxt` is empty for now.
    passWithNoTests: true,
    projects: [
      {
        resolve: {
          alias: {
            "~": fileURLToPath(new URL("./app", import.meta.url)),
          },
        },
        test: {
          name: "unit",
          include: ["test/unit/*.{test,spec}.ts"],
          // The IndexedDB layer is browser code (it relies on `localStorage`).
          environment: "happy-dom",
          setupFiles: ["test/setup.unit.ts"],
        },
      },
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["test/nuxt/*.{test,spec}.ts"],
          environment: "nuxt",
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL(".", import.meta.url)),
              domEnvironment: "happy-dom",
            },
          },
        },
      }),
    ],
  },
});
