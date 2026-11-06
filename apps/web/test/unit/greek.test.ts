import { expect, test } from "vitest";
import { transliterateGreek, transliterateHtml, transliterateText } from "../../app/utils/greek";

test("transliterateGreek", () => {
  expect(transliterateGreek("λόγος")).toBe("logos");
  expect(transliterateGreek("ϐίος")).toBe("bios");
  // The ano teleia and the middle dot are kept.
  expect(transliterateGreek("ἔργα·")).toBe("erga·");
  expect(transliterateGreek("λογο·τέχνης")).toBe("logo·technēs");
});

test("transliterateText: the Greek only", () => {
  expect(transliterateText("λογο·τέχνης, ου (ὁ) habile artisan de paroles"))
    .toBe("logo·technēs, ou (ho) habile artisan de paroles");
  expect(transliterateText("Étym. à propos")).toBe("Étym. à propos");
});

test("transliterateHtml: the text, not the tags", () => {
  expect(transliterateHtml(`<span class="grec" title="λόγος"><a href="/ho_(1)">ὁ</a></span> λ. <a data-linked-entries="hai_(1)">αἱ</a>`))
    .toBe(`<span class="grec" title="λόγος"><a href="/ho_(1)">ho</a></span> l. <a data-linked-entries="hai_(1)">hai</a>`);
});
