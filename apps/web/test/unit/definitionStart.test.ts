import { describe, expect, test } from "vitest";
import { truncateHtml, withDefinitionStart } from "../../app/utils/definitionStart";

describe("truncateHtml", () => {
  test("a text short enough is left whole", () => {
    const html = `<span class="grec">λόγος</span>, parole`;
    expect(truncateHtml(html, 13)).toBe(html);
    expect(truncateHtml(html, 100)).toBe(html);
  });

  test("cut after so many characters, an ellipsis added, the open elements closed", () => {
    const html = `<div class="pp"><span class="ppa">1</span> <span class="grec">λόγος</span>, parole</div><div class="pp">2</div>`;
    expect(truncateHtml(html, 5)).toBe(`<div class="pp"><span class="ppa">1</span> <span class="grec">λόγ…</span></div>`);
    // At the end of an element: that element closed, its parent too.
    expect(truncateHtml(html, 7)).toBe(`<div class="pp"><span class="ppa">1</span> <span class="grec">λόγος</span>…</div>`);
  });

  test("an entity counts as one character, and isn't cut", () => {
    expect(truncateHtml("a&gt;b c", 3)).toBe("a&gt;b…");
    expect(truncateHtml("a&gt;b", 1)).toBe("a…");
  });
});

describe("withDefinitionStart", () => {
  const long = (text: string) => `<div>${text.repeat(10)}</div>`;

  test("an entry: the beginning of its definition", () => {
    const entry = { word: "ὁ", uri: "ho_(1)", htmlDefinition: long("abcdefghij") };
    expect(withDefinitionStart(entry, 25).htmlDefinition).toBe(`<div>${"abcdefghij".repeat(2)}abcde…</div>`);
    expect(withDefinitionStart({ word: "τά", uri: "ta_(1)", htmlDefinition: "<p>ok</p>" }, 25).htmlDefinition).toBe("<p>ok</p>");
  });

  test("a group: the beginning of each homonym's", () => {
    const group = {
      word: "ἐρέω",
      uri: "ereô",
      htmlDefinition: "",
      children: [
        { word: "ἐρέω", uri: "ereô#1", htmlDefinition: "<p>dire</p>" },
        { word: "ἐρέω", uri: "ereô#2", htmlDefinition: long("demander ") },
      ],
    };
    expect(withDefinitionStart<"word" | "uri" | "htmlDefinition">(group, 10).children!.map(child => child.htmlDefinition))
      .toEqual(["<p>dire</p>", "<div>demander d…</div>"]);
  });
});
