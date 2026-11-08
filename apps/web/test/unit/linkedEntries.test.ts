import { expect, test } from "vitest";
import { formRoute, linkDefinition } from "../../app/utils/linkedEntries";

test("formRoute: the form alone, never its entries", () => {
  expect(formRoute("αἱ")).toBe(`/forme/${encodeURIComponent("αἱ")}`);
  expect(formRoute("δι’")).toBe(`/forme/${encodeURIComponent("δι’")}`);
});

test("linkDefinition: the ambiguous forms link to their page", () => {
  const html = `<span class="grec"><span data-linked-entries="hai_(1),ho_(1)">αἱ</span> λογάδες</span>`;
  expect(linkDefinition(html)).toBe(
    `<span class="grec"><a href="/forme/${encodeURIComponent("αἱ")}" data-linked-entries="hai_(1),ho_(1)">αἱ</a> λογάδες</span>`,
  );
});

test("linkDefinition: attributes and nested spans are kept", () => {
  const html = `<span lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</span>, <span data-linked-self>λόγῳ</span>`;
  expect(linkDefinition(html)).toBe(
    `<a href="/forme/${encodeURIComponent("πλέως")}" lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</a>, <span data-linked-self>λόγῳ</span>`,
  );
});

test("linkDefinition: the other links are left as they are, or turned into spans", () => {
  const html = `<a href="/ergon">ἔργα</a> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`;
  expect(linkDefinition(html)).toContain(`<a href="/ergon">ἔργα</a>`);
  expect(linkDefinition(html, { links: false })).toBe(`<span>ἔργα</span> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`);
});

test("linkDefinition: a linked span without text is left as it is", () => {
  const html = `<span data-linked-entries="hai_(1),ho_(1)"> </span> <span data-linked-entries="hê_(1),ho_(1)">ἡ</span>`;
  expect(linkDefinition(html)).toBe(
    `<span data-linked-entries="hai_(1),ho_(1)"> </span> <a href="/forme/${encodeURIComponent("ἡ")}" data-linked-entries="hê_(1),ho_(1)">ἡ</a>`,
  );
});
