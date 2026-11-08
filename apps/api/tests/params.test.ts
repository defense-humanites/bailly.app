import { assert, assertEquals } from "./support/assert.ts";
import { createApp } from "../src/app.ts";
import { app, dictionary } from "#test-app";
import { json } from "./support/http.ts";
import { test } from "./support/test.ts";

/*
 * The parameters of the requests (src/params.ts, schemas of
 * `@bailly/api-types/params`), as decided on 8 November 2026: a malformed value is
 * refused with a 400 and a JSON body, never replaced by a default; booleans are
 * `true`, `false`, `1`, `0` or an empty value (true); unknown parameters are
 * ignored; the batches are for development only.
 */

/** The 400 of a request: its message and the paths of its issues. */
async function refused(path: string): Promise<{ message: string; paths: string[] }> {
  const response = await app.request(path);
  assertEquals(response.status, 400, path);
  assertEquals(response.headers.get("Content-Type")?.split(";")[0], "application/json");
  assertEquals(response.headers.get("Cache-Control"), "no-store");
  const { error } = await json(response);
  assert(typeof error.message === "string", "message");
  return {
    message: error.message,
    paths: (error.issues ?? []).map((issue: { path: string; message: string }) => {
      assert(typeof issue.message === "string" && issue.message.length > 0);
      return issue.path;
    })
  };
}

async function accepted(path: string) {
  const response = await app.request(path);
  assertEquals(response.status, 200, path);
  return (await json(response)).data;
}

test("Parameters: the booleans", async () => {
  for (const value of ["true", "1", ""]) {
    const data = await accepted(`/entry/logos?fields=uri&siblings=${value}`);
    assert(data.siblings?.next, `siblings=${value}`);
  }
  assert((await accepted("/entry/logos?fields=uri&siblings")).siblings?.next, "?siblings");
  for (const value of ["false", "0"]) {
    const data = await accepted(`/entry/logos?fields=uri&siblings=${value}`);
    assertEquals(data.siblings?.next, undefined, `siblings=${value}`);
  }
  for (const value of ["yes", "no", "TRUE", "2"]) {
    assertEquals((await refused(`/entry/logos?siblings=${value}`)).paths, ["siblings"]);
  }
  assertEquals((await refused("/lookup/logos?morphology=oui")).paths, ["morphology"]);
});

test("Parameters: malformed values are refused, not replaced", async () => {
  assertEquals((await refused("/entry/logos?fields=word,nope")).paths, ["fields.1"]);
  assertEquals((await refused("/entry/logos?fields=")).paths, ["fields.0"]);
  assertEquals((await refused("/lookup/logos?inputMode=latin")).paths, ["inputMode"]);
  for (const value of ["0", "-1", "1.5", "abc"]) {
    assertEquals((await refused(`/lookup/logos?limit=${value}`)).paths, ["limit"]);
  }
  for (const value of ["400abc", "a,b", "1,2,3"]) {
    assertEquals((await refused(`/entry/random?lengthRange=${value}`)).paths, ["lengthRange"]);
  }
  // All the issues at once.
  assertEquals(
    (await refused("/lookup/logos?fields=nope&inputMode=latin&limit=0")).paths.sort(),
    ["fields.0", "inputMode", "limit"]
  );
});

test("Parameters: well-formed values, and unknown parameters ignored", async () => {
  const data = await accepted("/lookup/logos?inputMode=transliteration&fields=word,%20uri&limit=3&draw=123&k6=4");
  assertEquals(data.$query.fields, ["word", "uri"]);
  assertEquals(data.$query.limit, 3);
  assertEquals(data.$query.draw, undefined);
  assert(data.entries.length <= 3);
  const random = await accepted("/entry/random?fields=uri&lengthRange=700,400&draw=1");
  assertEquals(random.$query.lengthRange, [400, 700]);
});

test("Parameters: the excerpts' errors are JSON too", async () => {
  assertEquals((await refused("/entries/excerpts")).paths, []);
});

test({
  name: "Parameters: the batches only in development",
  // A second application, on the platform's dictionary (Node.js only).
  ignore: dictionary.preparedStatementCount > 0,
  fn: async () => {
    const production = createApp({ dictionary, morpheus: {} as never, batches: false });
    for (const path of ["/entry", "/lookup"]) {
      const response = await production.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: "logos" })
      });
      await response.body?.cancel();
      assertEquals(response.status, 404, path);
    }

    // The test application is in development: batches, with a body like a query.
    const response = await app.request("/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: ["logos", "psuchê"], fields: ["word", "uri"], siblings: false })
    });
    assertEquals(response.status, 200);
    const body = await json(response);
    assertEquals(body.count, 2);
    assertEquals(body.$query.fields, ["word", "uri"]);
  }
});
