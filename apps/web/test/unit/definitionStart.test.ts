import { describe, expect, test } from "vitest";
import { truncateHtml, withDefinitionStart } from "../../app/utils/definitionStart";

describe("truncateHtml", () => {
  test("a text short enough is left whole", () => {
    const html = `<span class="grec">λόγος</span>, parole`;
    expect(truncateHtml(html, 13)).toEqual({ html, length: 13 });
    expect(truncateHtml(html, 100)).toEqual({ html, length: 13 });
  });

  test("cut after so many characters, an ellipsis added, the open elements closed", () => {
    const html = `<div class="pp"><span class="ppa">1</span> <span class="grec">λόγος</span>, parole</div><div class="pp">2</div>`;
    expect(truncateHtml(html, 5)).toEqual({
      html: `<div class="pp"><span class="ppa">1</span> <span class="grec">λόγ…</span></div>`,
      length: 5,
    });
    // At the end of an element: that element closed, its parent too.
    expect(truncateHtml(html, 7).html).toBe(`<div class="pp"><span class="ppa">1</span> <span class="grec">λόγος</span>…</div>`);
  });

  test("characters by letter, an entity counting as one; void elements aren't closed", () => {
    expect(truncateHtml("a&amp;b<br>ὦ𝔞c", 5)).toEqual({ html: "a&amp;b<br>ὦ𝔞…", length: 5 });
    // A letter keeps its combining marks (a quantity mark and an accent).
    expect(truncateHtml("λᾱ́γος", 2).html).toBe("λᾱ́…");
    expect(truncateHtml("a&amp;b", 1).html).toBe("a…");
  });

  test("an element closed out of order doesn't confuse the others", () => {
    expect(truncateHtml("<div><span>ab</span><a href=\"/x\">cd</a>ef</div>", 5).html)
      .toBe("<div><span>ab</span><a href=\"/x\">cd</a>e…</div>");
  });
});

describe("withDefinitionStart", () => {
  const long = (text: string) => `<div>${text.repeat(10)}</div>`;

  test("an entry: the beginning of its definition", () => {
    const entry = { word: "ὁ", uri: "ho_(1)", htmlDefinition: long("abcdefghij") };
    expect(withDefinitionStart(entry, 25).htmlDefinition).toBe(`<div>${"abcdefghij".repeat(2)}abcde…</div>`);
    expect(withDefinitionStart({ word: "τά", uri: "ta_(1)", htmlDefinition: "<p>ok</p>" }, 25).htmlDefinition).toBe("<p>ok</p>");
  });

  test("a group: so many characters in all, the homonyms past them left out", () => {
    const group = {
      word: "ἐρέω",
      uri: "ereô",
      htmlDefinition: "",
      children: [
        { word: "ἐρέω", uri: "ereô#1", htmlDefinition: "<p>dire</p>" },
        { word: "ἐρέω", uri: "ereô#2", htmlDefinition: long("demander ") },
        { word: "ἐρέω", uri: "ereô#3", htmlDefinition: "<p>encore</p>" },
      ],
    };
    const shortened = withDefinitionStart<"word" | "uri" | "htmlDefinition">(group, 20);
    expect(shortened.children!.map(child => child.htmlDefinition)).toEqual(["<p>dire</p>", "<div>demander demande…</div>"]);
    // The first homonym is always kept.
    expect(withDefinitionStart<"word" | "uri" | "htmlDefinition">(group, 0).children).toHaveLength(1);
  });
});
