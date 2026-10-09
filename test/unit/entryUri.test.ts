import { expect, test } from "vitest";
import { entryRoute, homonymAnchor, numberHeadword } from "../../app/utils/entryUri";

test("entryRoute", () => {
  expect(entryRoute("logos")).toEqual({ path: "/logos", hash: "" });
  expect(entryRoute("oudos#2")).toEqual({ path: "/oudos", hash: "#2" });
  expect(entryRoute("ê_(1)#1")).toEqual({ path: "/ê_(1)", hash: "#1" });
});

test("homonymAnchor", () => {
  expect(homonymAnchor("oudos#12")).toBe("12");
  expect(homonymAnchor("logos")).toBeUndefined();
});

test("numberHeadword", () => {
  const head = (word: string): string => `<span class="entreea"><span class="grec">${word}</span></span>`;
  expect(numberHeadword(`${head("οὐδός,")} <span class="gens">οῦ</span>`, "1"))
    .toBe(`${head("οὐδός<sup class=\"homonym\">1</sup>,")} <span class="gens">οῦ</span>`);
  // A headword without a comma.
  expect(numberHeadword(`${head("ἀντι·θέω")} :`, "2")).toBe(`${head("ἀντι·θέω<sup class=\"homonym\">2</sup>")} :`);
  // No headword: unchanged.
  const html = "<span class=\"ital\">v.</span> <span class=\"grec\">ὁδός</span>";
  expect(numberHeadword(html, "2")).toBe(html);
});
