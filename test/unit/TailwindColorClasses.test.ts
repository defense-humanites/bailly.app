import { expect, test } from "vitest";
import { Color } from "../../app/enums";
import { TailwindColorClasses } from "../../app/TailwindColorClasses";

// @fixme One should have access to the default shades values.
const defaultShades = {
  "bg": 200,
  "hover:bg": 300,
  "active:bg": 400,
  "border": 300,
  "hover:border": 400,
  "active:border": 500,
  "ring": 300,
  "hover:ring": 400,
  "active:ring": 500,
  "text": 600,
  "hover:text": 700,
  "active:text": 700,
} as const;

const blue = new TailwindColorClasses(Color.Blue, { shades: defaultShades });
const greenTranslucent = new TailwindColorClasses(Color.Green, { shades: defaultShades, variant: "translucent" });

test("Multiple color classes", async () => {
  // Array of classes.
  expect(blue.classes(["bg"])).toBe("bg-blue-200");
  expect(blue.classes(["bg", "border"])).toBe("bg-blue-200 border-blue-300");
  expect(blue.classes(["text", "hover:text", "active:text"]))
    .toBe("text-blue-600 hover:text-blue-700 active:text-blue-700");

  // Object with class keys.
  expect(blue.classes({ bg: {} })).toBe("bg-blue-200");
  expect(blue.classes({ bg: { shade: 100 } })).toBe("bg-blue-100");
  expect(blue.classes({ bg: { variant: "translucent" } })).toBe("bg-blue-200/50");
  expect(blue.classes({ bg: { shade: 900, variant: "translucent" }, text: { shade: 100 } }))
    .toBe("bg-blue-900/50 text-blue-100");
  expect(blue.classes({ "border": { shade: 400 }, "hover:border": { shade: 600 }, "active:border": { shade: 800 } }))
    .toBe("border-blue-400 hover:border-blue-600 active:border-blue-800");

  // Array with classes and objects.
  expect(blue.classes(["bg", { ring: { shade: 500 } }])).toBe("bg-blue-200 ring-blue-500");
  expect(greenTranslucent.classes(["bg", "border", { ring: { variant: "solid" } }, "text"]))
    .toBe("bg-green-200/50 border-green-300/50 ring-green-300 text-green-600");
});

test("Single color classes", async () => {
  // Background
  expect(blue.background()).toBe("bg-blue-200");
  expect(blue.background({ state: "hover" })).toBe("hover:bg-blue-300");
  expect(blue.background({ state: "active" })).toBe("active:bg-blue-400");
  // expect(blue.background({ state: "unknown" })).toBe("active:bg-blue-400"); // @fixme Prevent things like `unknown:bg-blue-unknown`.

  // Border
  expect(blue.border()).toBe("border-blue-300");
  expect(blue.border({ state: "hover" })).toBe("hover:border-blue-400");
  expect(blue.border({ state: "active" })).toBe("active:border-blue-500");

  // Ring
  expect(blue.ring()).toBe("ring-blue-300");
  expect(blue.ring({ state: "hover" })).toBe("hover:ring-blue-400");
  expect(blue.ring({ state: "active" })).toBe("active:ring-blue-500");

  // Text
  expect(blue.text()).toBe("text-blue-600");
  expect(blue.text({ state: "hover" })).toBe("hover:text-blue-700");
  expect(blue.text({ state: "active" })).toBe("active:text-blue-700");
});
