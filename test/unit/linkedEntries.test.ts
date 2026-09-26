import { expect, test } from "vitest";
import { linkDefinition, readerRoute } from "../../app/utils/linkedEntries";

test("readerRoute", () => {
  expect(readerRoute(["hai_(1)", "ho_(1)"], "αἱ")).toBe(`/lecteur?q=hai_(1),ho_(1)&forme=${encodeURIComponent("αἱ")}`);
  expect(readerRoute(["logotechnês"])).toBe("/lecteur?q=logotechn%C3%AAs");
});

test("linkDefinition: the ambiguous forms link to the reader", () => {
  const html = `<span class="grec"><span data-linked-entries="hai_(1),ho_(1)">αἱ</span> λογάδες</span>`;
  expect(linkDefinition(html)).toBe(
    `<span class="grec"><a href="/lecteur?q=hai_(1),ho_(1)&amp;forme=${encodeURIComponent("αἱ")}" data-linked-entries="hai_(1),ho_(1)">αἱ</a> λογάδες</span>`,
  );
});

test("linkDefinition: attributes and nested spans are kept", () => {
  const html = `<span lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</span>, <span data-linked-self>λόγῳ</span>`;
  expect(linkDefinition(html)).toBe(
    `<a href="/lecteur?q=pleos,ple%C3%B4s&amp;forme=${encodeURIComponent("πλέως")}" lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</a>, <span data-linked-self>λόγῳ</span>`,
  );
});

test("linkDefinition: the other links are left as they are, or turned into spans", () => {
  const html = `<a href="/ergon">ἔργα</a> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`;
  expect(linkDefinition(html)).toContain(`<a href="/ergon">ἔργα</a>`);
  expect(linkDefinition(html, { links: false })).toBe(`<span>ἔργα</span> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`);
});
