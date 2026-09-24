import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { Color } from "../../app/enums";

// Tests run from the project root.
const css = readFileSync("app/assets/css/tag-colors.css", "utf8");

test("each color key maps to its palette in tag-colors.css", () => {
  for (const [key, palette] of Object.entries(Color)) {
    const rule = new RegExp(`\\[data-tag-color="${key}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    expect(rule, key).toBeDefined();
    for (const shade of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(rule, `${key} ${shade}`).toContain(`--tag-${shade}: var(--color-${palette}-${shade});`);
    }
  }
});
