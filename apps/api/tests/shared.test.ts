import { assertEquals } from "./support/assert.ts";
import { Shared } from "../src/shared.ts";
import { test } from "./support/test.ts";

/*
 * `Shared` (src/shared.ts): a value initialized once and shared, without ever
 * leaving a request waiting for the pending initialization of another, canceled
 * one (production, 4 November 2026: every search of an isolate hung).
 */

test("Shared: initialized once, then the value itself", async () => {
  let calls = 0;
  const shared = new Shared(async () => ++calls);
  assertEquals(await Promise.all([shared.get(), shared.get()]), [1, 1]);
  assertEquals(await shared.get(), 1);
  assertEquals(calls, 1);
});

test("Shared: a stuck initialization is given up and started afresh", async () => {
  let calls = 0;
  const shared = new Shared(
    // The first never settles, as the read of a canceled request on Workers.
    () => (++calls === 1 ? new Promise<number>(() => {}) : Promise.resolve(calls)),
    { patience: 20 }
  );
  void shared.get(); // the canceled request
  assertEquals(await shared.get(), 2);
  assertEquals(await shared.get(), 2);
  assertEquals(calls, 2);
});

test("Shared: a failed initialization is retried", async () => {
  let calls = 0;
  const shared = new Shared(async () => {
    if (++calls === 1) throw new Error("first");
    return calls;
  });
  let failed = false;
  await shared.get().catch(() => (failed = true));
  assertEquals(failed, true);
  assertEquals(await shared.get(), 2);
});

test("Shared: reset() forgets the value", async () => {
  let calls = 0;
  const shared = new Shared(async () => ++calls);
  assertEquals(await shared.get(), 1);
  shared.reset();
  assertEquals(await shared.get(), 2);
});
