import { mountSuspended } from "@nuxt/test-utils/runtime";
import { expect, test } from "vitest";
import EntryCard from "~/components/EntryCard.vue";

test("an excerpt is rendered as text, never as HTML (it may come from an imported or synchronized bookmark)", async () => {
  const excerpt = "<img src=x onerror=alert(1)> λόγος";
  const card = await mountSuspended(EntryCard, { props: { entry: { word: "λόγος", uri: "logos", excerpt } } });

  expect(card.find("img").exists()).toBe(false);
  expect(card.text()).toContain("<img src=x");
});

test("a definition from the API is rendered as HTML", async () => {
  const card = await mountSuspended(EntryCard, {
    props: { entry: { word: "λόγος", uri: "logos", excerpt: "λόγος", htmlDefinition: "<p><b>λόγος</b>, ου (ὁ)</p>" } },
  });

  expect(card.find(".definition b").text()).toBe("λόγος");
});
