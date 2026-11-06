// @vitest-environment node
import { createApp, eventHandler, toWebHandler } from "h3";
import { expect, test } from "vitest";
import { readBoundedJson } from "../../server/utils/syncLockers";

/**
 * A route that reads a body of at most 10 bytes, as a web handler.
 */
const handler = toWebHandler(createApp().use(eventHandler(event => readBoundedJson(event, 10))));

const put = (body: BodyInit, headers: Record<string, string> = {}) =>
  handler(new Request("http://localhost/", { method: "PUT", body, headers, duplex: "half" } as RequestInit));

test("a JSON body within the limit is read", async () => {
  const response = await put(JSON.stringify({ a: 1 }), { "Content-Length": "7" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ a: 1 });
});

test("a body without Content-Length is refused before being read", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ a: 1 })));
      controller.close();
    },
  });
  expect((await put(stream)).status).toBe(411);
});

test("a body larger than the limit is refused", async () => {
  expect((await put(JSON.stringify({ a: "0123456789" }), { "Content-Length": "18" })).status).toBe(413);
  // A Content-Length that understates the body.
  expect((await put(JSON.stringify({ a: "0123456789" }), { "Content-Length": "5" })).status).not.toBe(200);
});

test("a body that is not JSON is refused", async () => {
  expect((await put("nope", { "Content-Length": "4" })).status).toBe(400);
});
