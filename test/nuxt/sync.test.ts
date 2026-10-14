import { createPinia, type Pinia } from "pinia";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { Idb, IdbMetaKey } from "~/idb";
import { toBase64url } from "~/sync/base64url";
import { useBookmarksStore } from "~/stores/bookmarks";
import { useSyncStore } from "~/stores/sync";

/**
 * A server of lockers in memory, counting the requests (as the rate limiting
 * rule of Cloudflare would), which can answer as too busy (429).
 */
function fakeServer() {
  const lockers = new Map<string, { version: number; blob: string }>();
  const requests: string[] = [];
  let busy = 0;
  const handler = (input: RequestInfo | URL, init: RequestInit = {}): Response => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init.method ?? "GET";
    requests.push(method);
    if (busy > 0) {
      busy--;
      return new Response("", { status: 429 });
    }
    const id = url.split("/").pop()!;
    const stored = lockers.get(id);
    if (method === "GET") return stored ? Response.json(stored) : new Response(null, { status: 404 });
    const body = JSON.parse(init.body as string) as { version: number; blob: string };
    if (body.version !== (stored?.version ?? 0)) return Response.json({ data: { version: stored?.version ?? 0 } }, { status: 412 });
    const next = { version: body.version + 1, blob: body.blob };
    lockers.set(id, next);
    return Response.json({ version: next.version });
  };
  return {
    fetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(input, init))),
    requests,
    /** Answers the next requests as too busy. */
    busyFor(count: number) {
      busy = count;
    },
  };
}

/**
 * Web Locks shared by the stores of a test, as by the tabs of a browser.
 */
function fakeLocks() {
  let queue = Promise.resolve();
  return {
    request: <T>(_name: string, _options: unknown, callback: () => Promise<T>): Promise<T> => {
      const run = queue.then(callback);
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

let server: ReturnType<typeof fakeServer>;

// The application's own store (cf. `plugins/sync.client.ts`) loads its
// settings once ready: before the tests enable the synchronization, so that
// it stays disabled.
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    onNuxtReady(() => {
      resolve();
    });
  });
  await new Promise(resolve => setTimeout(resolve, 100));
});

beforeEach(() => {
  server = fakeServer();
  vi.stubGlobal("fetch", server.fetch);
  Object.defineProperty(navigator, "locks", { value: fakeLocks(), configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "locks");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const secret = toBase64url(new Uint8Array(16).fill(7));

/**
 * The store of a tab (its own Pinia), the synchronization enabled on this
 * device (its settings in IndexedDB).
 */
async function newTab(): Promise<ReturnType<typeof useSyncStore>> {
  const pinia: Pinia = createPinia();
  await useBookmarksStore(pinia).initialize();
  const store = useSyncStore(pinia);
  await store.load();
  return store;
}

async function enable(lastSyncedAt: number | null = null): Promise<void> {
  await Idb.writeMeta(IdbMetaKey.Sync, { secret, lastSyncedAt, bookmarks: true, preferences: [] });
}

test("a synchronization looking for changes is skipped when another tab synchronized lately", async () => {
  await enable();
  const first = await newTab();
  const second = await newTab();

  expect(await first.sync({ ifStale: 10_000 })).toBe(true);
  expect(server.requests).toEqual(["GET", "PUT"]);
  expect(first.lastSyncedAt).not.toBeNull();

  // The second tab's state does not know it: IndexedDB tells.
  server.requests.length = 0;
  expect(await second.sync({ ifStale: 10_000 })).toBe(true);
  expect(server.requests).toEqual([]);
  expect(second.status).toBe("idle");
  expect(second.lastSyncedAt).toBe(first.lastSyncedAt);

  // Without the condition (a change, or asked by the user): synchronized.
  expect(await second.sync()).toBe(true);
  expect(server.requests).toEqual(["GET"]);
});

test("a synchronization looking for changes runs once the latest one is old enough", async () => {
  await enable(Date.now() - 60_000);
  const tab = await newTab();
  expect(await tab.sync({ ifStale: 10_000 })).toBe(true);
  expect(server.requests).toEqual(["GET", "PUT"]);
});

test("a change not yet sent (e.g. the page reloaded first) is not skipped, then forgotten once sent", async () => {
  await enable(Date.now());
  const tab = await newTab();
  tab.changed(60_000); // Not sent before the reload…
  const reloaded = await newTab();
  expect(await reloaded.sync({ ifStale: 10_000 })).toBe(true);
  expect(server.requests).toEqual(["GET", "PUT"]);
  expect(localStorage.getItem("bailly:syncPending")).toBeNull();
  // Sent: the next one is skipped.
  server.requests.length = 0;
  expect(await reloaded.sync({ ifStale: 10_000 })).toBe(true);
  expect(server.requests).toEqual([]);
});

test("tabs opened at once: one synchronizes, the others wait for it and skip theirs", async () => {
  await enable();
  const tabs = await Promise.all([newTab(), newTab(), newTab()]);
  const results = await Promise.all(tabs.map(tab => tab.sync({ ifStale: 10_000 })));
  expect(results).toEqual([true, true, true]);
  expect(server.requests).toEqual(["GET", "PUT"]);
});

test("a change scheduled is not made conditional by a later request looking for changes", async () => {
  await enable(Date.now());
  const tab = await newTab();
  tab.schedule(); // A change.
  tab.schedule(0, { ifStale: 10_000 }); // Back on the tab.
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET", "PUT"]);
  });
});

test("the server too busy: retried silently while it stays isolated, then told", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();

  // Isolated: no error, a retry scheduled.
  server.busyFor(1);
  expect(await tab.sync()).toBe(false);
  expect(tab.status).toBe("idle");
  expect(tab.error).toBeNull();
  await vi.advanceTimersByTimeAsync(15_000);
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET", "GET", "PUT"]);
  });
  expect(tab.status).toBe("idle");

  // Repeated: told at the third refusal in a row.
  server.requests.length = 0;
  server.busyFor(3);
  expect(await tab.sync()).toBe(false);
  expect(tab.error).toBeNull();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(tab.error).toBeNull();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(tab.status).toBe("error");
  expect(tab.error).toMatch(/très sollicité/);
  // It still retries, and the error goes once it succeeds.
  await vi.advanceTimersByTimeAsync(15_000);
  await vi.waitFor(() => {
    expect(tab.status).toBe("idle");
  });
  expect(tab.error).toBeNull();
});

test("the server too busy for more than a minute: told", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();
  server.busyFor(1);
  expect(await tab.sync()).toBe(false);
  expect(tab.error).toBeNull();
  // A minute later (e.g. the retry deferred), refused again.
  vi.setSystemTime(Date.now() + 61_000);
  server.busyFor(1);
  expect(await tab.sync()).toBe(false);
  expect(tab.status).toBe("error");
});
