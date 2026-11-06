import bcd from "@mdn/browser-compat-data/forLegacyNode";
import type { Identifier, SimpleSupportStatement } from "@mdn/browser-compat-data/types";
import { expect, test } from "@nuxt/test-utils/playwright";
import { searchInput, searchResults } from "./helpers";

/*
 * Safari 16.4 (iOS 16.4) is the stack's floor (Tailwind CSS 4, Vite; cf.
 * `app/assets/outdated-browser.js`): the code run by the browser must not
 * rely on what came after it, unless it checks for it first. One such API
 * (`URL.canParse`, of Safari 17) stopped the application on iOS 16 (issue
 * #10). Here, every JavaScript and Web API that iOS 16.4 lacks, according
 * to MDN's compatibility data, is removed from Chromium before the page
 * runs: the globals, the static members and those of the prototypes.
 */
const FLOOR = [16, 4] as const;

/** Whether iOS's Safari lacks a feature at the floor. */
const lacks = (statement: SimpleSupportStatement | SimpleSupportStatement[] | undefined): boolean => {
  const support = Array.isArray(statement) ? statement[0] : statement;
  if (!support) return false;
  if (support.flags || support.prefix || support.alternative_name || support.partial_implementation) return true;
  const added = support.version_added;
  if (added === false || added === "preview") return true;
  const [major = 0, minor = 0] = added.replace("≤", "").split(".").map(Number);
  return major > FLOOR[0] || (major === FLOOR[0] && minor > FLOOR[1]);
};

interface Missing {
  globals: string[];
  /** Static members (`URL.canParse`), or of builtins (`Object.groupBy`). */
  statics: [string, string][];
  /** Members of the prototypes (`Set.prototype.union`). */
  members: [string, string][];
}

const missing: Missing = { globals: [], statics: [], members: [] };
const trees = [[bcd.javascript.builtins, true], [bcd.api, false]] as [Record<string, Identifier>, boolean][];
for (const [tree, builtins] of trees) {
  for (const [owner, node] of Object.entries(tree)) {
    if (lacks(node.__compat?.support.safari_ios)) {
      missing.globals.push(owner);
      continue;
    }
    for (const [key, member] of Object.entries(node) as [string, Identifier][]) {
      if (key === "__compat" || !/^[A-Za-z$][\w$]*$/.test(key) || !lacks(member.__compat?.support.safari_ios)) continue;
      if (key.endsWith("_static")) missing.statics.push([owner, key.slice(0, -"_static".length)]);
      // A builtin's static members are not told apart from its prototype's.
      else if (builtins) missing.statics.push([owner, key], [owner, `prototype.${key}`]);
      else missing.members.push([owner, key]);
    }
  }
}

test("the application with the APIs of Safari 16.4 only", async ({ page, goto }) => {
  // Sanity check: the data tells the API of the issue.
  expect(missing.statics).toContainEqual(["URL", "canParse"]);
  await page.addInitScript(({ globals, statics, members }: Missing) => {
    const scope = globalThis as unknown as Record<string, Record<string, unknown> | undefined>;
    const remove = (owner: Record<string, unknown> | undefined, key: string): void => {
      if (owner && Object.hasOwn(owner, key)) Reflect.deleteProperty(owner, key);
    };
    for (const [owner, path] of statics) {
      const [first, second] = path.split(".");
      if (second) remove(scope[owner]?.[first!] as Record<string, unknown> | undefined, second);
      else remove(scope[owner], first!);
    }
    for (const [owner, key] of members) remove(scope[owner]?.prototype as Record<string, unknown> | undefined, key);
    for (const name of globals) remove(scope, name);
  }, missing);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await goto("/", { waitUntil: "hydration" });
  expect(await page.evaluate(() => typeof (URL as { canParse?: unknown }).canParse)).toBe("undefined");
  await searchInput(page).fill("logos");
  await expect(searchResults(page).getByRole("option").filter({ hasText: "λόγος" }).first()).toBeVisible();
  for (const path of ["/logos", "/signets", "/préférences"]) {
    await goto(path, { waitUntil: "hydration" });
    await expect(page.getByText("Une erreur est survenue")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
