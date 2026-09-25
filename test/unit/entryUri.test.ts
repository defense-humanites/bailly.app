import { expect, test } from "vitest";
import { entryRoute, homonymAnchor } from "../../app/utils/entryUri";

test("entryRoute", () => {
  expect(entryRoute("logos")).toEqual({ path: "/logos", hash: "" });
  expect(entryRoute("oudos#2")).toEqual({ path: "/oudos", hash: "#2" });
  expect(entryRoute("ê_(1)#1")).toEqual({ path: "/ê_(1)", hash: "#1" });
});

test("homonymAnchor", () => {
  expect(homonymAnchor("oudos#12")).toBe("12");
  expect(homonymAnchor("logos")).toBeUndefined();
});
