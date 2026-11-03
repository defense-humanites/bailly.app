import { assert } from "./support/assert.ts";
import { app, dictionary } from "#test-app";
import { test } from "./support/test.ts";

/*
 * The Worker tells, in `Server-Timing`, which isolate served a response and whether
 * it started it (cf. `src/worker.ts`). Workers only: the Node.js server has no such
 * header (`preparedStatementCount` is 0 on D1 only).
 */

test({
  name: "Worker: `Server-Timing` names the isolate",
  ignore: dictionary.preparedStatementCount > 0,
  fn: async () => {
    const response = await app.request("/");
    await response.body?.cancel();
    const timing = response.headers.get("Server-Timing") ?? "";
    assert(/isolate;desc="[0-9a-f]{8}", requests;desc="\d+"/.test(timing), timing);
  }
});
