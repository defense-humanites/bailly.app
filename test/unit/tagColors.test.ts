import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { Color, colorNames } from "../../app/enums";
import { IdbTags } from "../../app/idb";

// Tests run from the project root.
const css = readFileSync("app/assets/css/tag-colors.css", "utf8");

// The palettes that replace Tailwind's in the theme (cf. `theme.css`).
const THEME_PALETTES: Record<string, string> = { yellow: "gold" };

test("each color key maps to its palette in tag-colors.css", () => {
  for (const [key, value] of Object.entries(Color)) {
    const palette = THEME_PALETTES[value] ?? value;
    const rule = new RegExp(`\\[data-tag-color="${key}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    expect(rule, key).toBeDefined();
    for (const shade of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      expect(rule, `${key} ${shade}`).toContain(`--tag-${shade}: var(--color-${palette}-${shade});`);
    }
  }
});

test("each color key has a French name", () => {
  for (const key of Object.keys(Color) as (keyof typeof Color)[]) {
    expect(colorNames[key], key).toMatch(/^\p{Ll}[\p{L} ]*$/u);
  }
});

test("the color picker's order lists every tag color once", () => {
  expect([...IdbTags.colorKeysByHue].sort()).toEqual([...IdbTags.colorKeys].sort());
});
