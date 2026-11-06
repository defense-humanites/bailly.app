import { expect, test } from "vitest";
import { formRoute, linkDefinition } from "../../app/utils/linkedEntries";

test("formRoute", () => {
  expect(formRoute(["hai_(1)", "ho_(1)"], "αἱ")).toBe(`/forme/${encodeURIComponent("αἱ")}?q=hai_(1),ho_(1)`);
  expect(formRoute(["logotechnês"])).toBe("/forme?q=logotechn%C3%AAs");
});

test("linkDefinition: the ambiguous forms link to the reader", () => {
  const html = `<span class="grec"><span data-linked-entries="hai_(1),ho_(1)">αἱ</span> λογάδες</span>`;
  expect(linkDefinition(html)).toBe(
    `<span class="grec"><a href="/forme/${encodeURIComponent("αἱ")}?q=hai_(1),ho_(1)" data-linked-entries="hai_(1),ho_(1)">αἱ</a> λογάδες</span>`,
  );
});

test("linkDefinition: attributes and nested spans are kept", () => {
  const html = `<span lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</span>, <span data-linked-self>λόγῳ</span>`;
  expect(linkDefinition(html)).toBe(
    `<a href="/forme/${encodeURIComponent("πλέως")}?q=pleos,ple%C3%B4s" lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</a>, <span data-linked-self>λόγῳ</span>`,
  );
});

test("linkDefinition: the other links are left as they are, or turned into spans", () => {
  const html = `<a href="/ergon">ἔργα</a> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`;
  expect(linkDefinition(html)).toContain(`<a href="/ergon">ἔργα</a>`);
  expect(linkDefinition(html, { links: false })).toBe(`<span>ἔργα</span> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`);
});
