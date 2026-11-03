import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { assert } from "./support/assert.ts";
import { test } from "./support/test.ts";
import { DATABASE } from "../src/defaults.ts";

/*
 * The current database revision (`src/defaults.ts`) is committed as a `.gz` archive,
 * decompressed at startup on Node.js (and imported into D1 for the Worker): the
 * archive must exist and be tracked by git (the `.db` file is ignored). These tests
 * catch the omission before a deployment does.
 *
 * Node.js only (git, file system).
 */

const gzPath = `${DATABASE.filePath}.gz`;

const exists = (path: string) => stat(path).then(() => true, () => false);

const git = (...args: string[]): boolean =>
  spawnSync("git", args, { stdio: "ignore" }).status === 0;

const isGitRepository = await exists(".git");

/**
 * In the public repository (defense-humanites/bailly-api), the database is not
 * distributed: its archives are ignored by git, and these tests don't apply.
 */
const isDatabaseDistributed = !isGitRepository || !git("check-ignore", "-q", gzPath);

if (!isDatabaseDistributed) {
  console.info("The database isn't distributed with this repository: tests ignored.");
}

test({
  name: `${gzPath} exists (cf. \`npm run db:pack\`)`,
  ignore: !isDatabaseDistributed,
  fn: async () => {
    const file = await stat(gzPath).catch(() => undefined);
    assert(file?.isFile(), `${gzPath} is missing: run \`npm run db:pack\``);
  }
});

test({
  name: `${gzPath} is tracked by git`,
  ignore: !isGitRepository || !isDatabaseDistributed,
  fn: () => {
    assert(
      git("ls-files", "--error-unmatch", gzPath),
      `${gzPath} isn't tracked: git add ${gzPath}`
    );
  }
});
