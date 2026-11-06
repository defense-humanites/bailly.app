import { expect, test } from "vitest";
import { definitionLength, isLongDefinition } from "../../app/utils/definitionLength";

test("definitionLength: the text, without the tags", () => {
  expect(definitionLength(`<span class="grec">λόγος,</span>\n  <span>ου</span>`)).toBe("λόγος, ου".length);
});

test("isLongDefinition, depending on the reading size", () => {
  expect(isLongDefinition(1000, "normal")).toBe(false);
  expect(isLongDefinition(1300, "normal")).toBe(true);
  expect(isLongDefinition(1000, "larger")).toBe(true);
  expect(isLongDefinition(1300, "small")).toBe(false);
});
