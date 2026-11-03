/**
 * `test()` with the signature of `Deno.test()` (the suite was written for Deno), over
 * Vitest: `test(name, fn)` or `test({ name, ignore, fn })`.
 */

import { test as vitestTest } from "vitest";

type TestFn = () => void | Promise<void>;
type TestOptions = { name: string; ignore?: boolean; fn: TestFn };

export function test(name: string, fn: TestFn): void;
export function test(options: TestOptions): void;
export function test(nameOrOptions: string | TestOptions, fn?: TestFn): void {
  const { name, ignore = false, fn: testFn } = typeof nameOrOptions === "string"
    ? { name: nameOrOptions, fn: fn! }
    : nameOrOptions;

  vitestTest.skipIf(ignore)(name, testFn);
}
