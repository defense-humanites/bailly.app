import { assert, assertEquals } from "./support/assert.ts";
import { app, morpheusAvailable } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";
import { linkedForms } from "../src/model/derived.ts";

/*
 * The entries a form may belong to, `GET /form/:form` (cf. `src/model/form.ts`): those
 * of its links in the definitions (`bailly_form`, revision 6), or those it matches as
 * a whole word; never those of the request.
 */

type FormEntry = { uri: string; word?: string; children?: FormEntry[] };
type FormData = { version: string; form: string; entries: FormEntry[] };

const getForm = async (form: string, query = "?fields=word,uri"): Promise<FormData> => {
  const response = await app.request(`/form/${encodeURIComponent(form)}${query}`);
  assertEquals(response.status, 200, form);
  return (await json(response)).data;
};

const uris = (data: FormData): string[] => data.entries.map((entry) => entry.uri);

test("GET /form/:form: a linked form, its entries in the order of its links", async () => {
  const data = await getForm("ἐρῶ");
  assertEquals(data.form, "ἐρῶ");
  assertEquals(uris(data), ["eraô-ô", "ereô", "erô_(2)"]);
  // A group of homonyms is one entry, with its children (as `GET /entry/:uri`).
  assert(data.entries[1]!.children?.length);
  assert(data.version);

  assertEquals(uris(await getForm("αἱ")), ["hai_(1)", "ho_(1)"]);
  // Elisions, supposed forms, hyphens: as linked.
  assertEquals(uris(await getForm("δι’")), ["di", "dia", "dio"]);
  assertEquals(uris(await getForm("*ἀκέω")), ["akeô-ô", "akeô"]);
  assertEquals(uris(await getForm("αὖ-τε")), ["au", "aute"]);
});

test("GET /form/:form: the request can't choose the entries", async () => {
  // The former page took its entries from `?q=`.
  assertEquals(uris(await getForm("ἐρῶ", "?fields=uri&q=eraô-ô,ereô,logos,erô_(2)")), [
    "eraô-ô",
    "ereô",
    "erô_(2)"
  ]);
  assertEquals(uris(await getForm("Le professeur est nul", "?fields=uri&q=logos")), []);
});

test("GET /form/:form: another Greek word, matched as a whole word", async () => {
  // The strictest comparison that finds headwords wins.
  assertEquals(uris(await getForm("χάρις")), ["charis"]);
  assertEquals(uris(await getForm("Χάρις")), ["Charis"]);
  assertEquals(uris(await getForm("χαρις")), ["charis", "Charis"]);
  assertEquals(uris(await getForm("λόγος")), ["logos"]);
});

test({
  name: "GET /form/:form: an inflected form, the lemmas of its analyses",
  ignore: !morpheusAvailable,
  fn: async () => {
    assertEquals(uris(await getForm("λόγου")), ["logos", "logoô-ô"]);
  }
});

test("GET /form/:form: nothing for an unknown form or what isn't a Greek word", async () => {
  for (const form of ["ξξξξ", "hello", "λόγος λόγος", "λ*γος", "λ".repeat(51)]) {
    const data = await getForm(form);
    assertEquals(data.entries, [], form);
  }
});

test("GET /form/:form: the requested fields", async () => {
  const [entry] = (await getForm("αἱ", "?fields=word,uri,excerpt")).entries;
  assertEquals(Object.keys(entry!).toSorted(), ["excerpt", "uri", "word"]);
  const response = await app.request(`/form/${encodeURIComponent("αἱ")}?fields=nope`);
  assertEquals(response.status, 400);
  await response.body?.cancel();
});

test("linkedForms: the text and the URIs of each linked span, nested spans included", () => {
  assertEquals(
    linkedForms(
      `<span class="grec"><span data-linked-entries="hai_(1),ho_(1)">αἱ</span> λογάδες</span>, ` +
        `<span lang="grc" data-linked-entries="pleos,pleôs" class="x"><span class="up">πλέ</span>ως</span>, ` +
        `<span data-linked-self>λόγῳ</span>, <span data-linked-entries="">x</span>`
    ),
    [
      { form: "αἱ", uris: ["hai_(1)", "ho_(1)"] },
      { form: "πλέως", uris: ["pleos", "pleôs"] }
    ]
  );
  // An unclosed span ends the reading.
  assertEquals(linkedForms(`<span data-linked-entries="a,b">αβ`), []);
});
