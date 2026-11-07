import { assert, assertEquals } from "./support/assert.ts";
import { app, dictionary } from "#test-app";
import { test } from "./support/test.ts";

/*
 * A request with a `Bailly-Diagnostics` header learns from the Worker, in
 * `Server-Timing`, which isolate served it and whether it started it (cf.
 * `src/worker.ts`); such a response is never kept by a cache. Workers only: the
 * Node.js server has no such header (`preparedStatementCount` is 0 on D1 only).
 */

const workersOnly = dictionary.preparedStatementCount > 0;

test({
  name: "Worker: `Server-Timing` names the isolate when asked, and is not cached",
  ignore: workersOnly,
  fn: async () => {
    const response = await app.request("/lookup/λογ", {
      headers: { "Bailly-Diagnostics": "1" }
    });
    await response.body?.cancel();
    const timing = response.headers.get("Server-Timing") ?? "";
    assert(/isolate;desc="[0-9a-f]{8}", requests;desc="\d+"/.test(timing), timing);
    assertEquals(response.headers.get("Cache-Control"), "no-store");
  }
});

test({
  name: "Worker: no `Server-Timing` unless asked",
  ignore: workersOnly,
  fn: async () => {
    const response = await app.request("/lookup/λογ");
    await response.body?.cancel();
    assertEquals(response.headers.get("Server-Timing"), null);
  }
});
