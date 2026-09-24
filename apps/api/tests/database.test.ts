import { assert } from "@std/assert";
import { DATABASE } from "../src/defaults.ts";

/*
 * The current database revision (`src/defaults.ts`) is deployed as a `.gz` archive,
 * decompressed at startup: the archive must exist, be tracked by git (the `.db` file
 * is ignored) and not be excluded from the Heroku slug. Otherwise, the release phase
 * would reject the deployment; these tests catch the omission earlier.
 */

const gzPath = `${DATABASE.filePath}.gz`;

const isGitRepository = await Deno.stat(".git").then(() => true, () => false);

/**
 * In the public repository (defense-humanites/bailly-api, cf. `scripts/sync_public.sh`),
 * the database is not distributed: its archives are ignored by git, and these tests
 * don't apply.
 */
const isDatabaseDistributed = !isGitRepository || !(
  await new Deno.Command("git", {
    args: ["check-ignore", "-q", gzPath],
    stdout: "null",
    stderr: "null"
  }).output()
).success;

if (!isDatabaseDistributed) {
  console.info("The database isn't distributed with this repository: tests ignored.");
}

Deno.test({
  name: `${gzPath} exists (cf. \`deno task db:pack\`)`,
  ignore: !isDatabaseDistributed,
  fn: async () => {
    const stat = await Deno.stat(gzPath).catch(() => undefined);
    assert(stat?.isFile, `${gzPath} is missing: run \`deno task db:pack\``);
  }
});

Deno.test({
  name: `${gzPath} is tracked by git`,
  ignore: !isGitRepository || !isDatabaseDistributed,
  fn: async () => {
    const { success } = await new Deno.Command("git", {
      args: ["ls-files", "--error-unmatch", gzPath],
      stdout: "null",
      stderr: "null"
    }).output();
    assert(success, `${gzPath} isn't tracked: git add ${gzPath}`);
  }
});

Deno.test({
  name: `${gzPath} is not excluded by .slugignore`,
  ignore: !isDatabaseDistributed,
  fn: async () => {
    const patterns = (await Deno.readTextFile(".slugignore"))
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    assert(
      !patterns.includes(gzPath) && !patterns.includes(`/${gzPath}`),
      `${gzPath} is listed in .slugignore: it would be missing from the slug`
    );
  }
});
