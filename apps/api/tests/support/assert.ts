/**
 * The assertions of `@std/assert` used by the suite (written for Deno), over
 * `node:assert` (available in Node.js and, through `nodejs_compat`, in Workers).
 */

import nodeAssert from "node:assert/strict";

export function assert(expr: unknown, msg?: string): asserts expr {
  nodeAssert.ok(expr, msg);
}

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  nodeAssert.deepStrictEqual(actual, expected, msg);
}

/** Deep equality, without throwing. */
export function equal(a: unknown, b: unknown): boolean {
  try {
    nodeAssert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}
