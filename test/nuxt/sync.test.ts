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
  let retryAfter: string | null = null;
  const handler = (input: RequestInfo | URL, init: RequestInit = {}): Response => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init.method ?? "GET";
    requests.push(method);
    if (busy > 0) {
      busy--;
      return new Response("", { status: 429, headers: retryAfter ? { "Retry-After": retryAfter } : {} });
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
    busyFor(count: number, seconds: number | null = null) {
      busy = count;
      retryAfter = seconds === null ? null : String(seconds);
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
  expect(await second.sync({ asked: true })).toBe(true);
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
  expect(await tab.sync({ asked: true })).toBe(false);
  expect(tab.error).toBeNull();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(tab.error).toBeNull();
  await vi.advanceTimersByTimeAsync(15_000);
  await vi.waitFor(() => {
    expect(tab.status).toBe("error");
  });
  expect(tab.error).toMatch(/très sollicité/);
  // It still retries, less often (30 s), and the error goes once it succeeds.
  expect(server.requests).toEqual(["GET", "GET", "GET"]);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(server.requests).toHaveLength(3);
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

test("the server too busy, telling when to retry: retried then", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();
  server.busyFor(1, 60);
  expect(await tab.sync()).toBe(false);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(server.requests).toEqual(["GET"]);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET", "GET", "PUT"]);
  });
});

test("the server too busy: the retry is skipped if another tab synchronized meanwhile", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const first = await newTab();
  const second = await newTab();
  server.busyFor(1);
  expect(await first.sync()).toBe(false);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await second.sync({ asked: true })).toBe(true);
  server.requests.length = 0;
  expect(first.lastSyncedAt).toBeNull();
  await vi.advanceTimersByTimeAsync(5_000); // The retry, 15 s after the refusal.
  // (Run, and skipped: the date of the other tab's synchronization known.)
  await vi.waitFor(() => {
    expect(first.lastSyncedAt).toBe(second.lastSyncedAt);
  });
  expect(server.requests).toEqual([]);
  expect(first.status).toBe("idle");
});

test("at most one synchronization every few seconds, but those asked by the user", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();
  expect(await tab.sync()).toBe(true);
  expect(server.requests).toEqual(["GET", "PUT"]);
  // A change right after: sent 5 s after the latest synchronization.
  const later = tab.sync();
  await vi.advanceTimersByTimeAsync(4_000);
  expect(server.requests).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await later).toBe(true);
  expect(server.requests).toEqual(["GET", "PUT", "GET"]);
  // Asked by the user: at once.
  expect(await tab.sync({ asked: true })).toBe(true);
  expect(server.requests).toHaveLength(4);
});

test("a change is sent 3 s after the user pauses, and no later than 10 s after the first one", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable(Date.now());
  const tab = await newTab();

  // A change alone: sent 3 s later.
  tab.changed();
  await vi.advanceTimersByTimeAsync(2_900);
  expect(server.requests).toEqual([]);
  await vi.advanceTimersByTimeAsync(100);
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET", "PUT"]);
  });

  // Changes every 2 s: sent 10 s after the first one, not after the last.
  server.requests.length = 0;
  await vi.advanceTimersByTimeAsync(10_000);
  for (let i = 0; i < 5; i++) {
    tab.changed(); // At 0, 2, 4, 6 and 8 s.
    await vi.advanceTimersByTimeAsync(i < 4 ? 2_000 : 1_900);
  }
  expect(server.requests).toEqual([]);
  await vi.advanceTimersByTimeAsync(100); // 10 s.
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET"]);
  });
});

test("the page hidden: a change waiting is sent at once, even right after another synchronization", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();
  expect(await tab.sync()).toBe(true);
  server.requests.length = 0;
  tab.changed();
  tab.flush(); // Not paced: the page may be closing.
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET"]);
  });
});

test("the page hidden: nothing is sent but a change (not a retry, not a reception)", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable(Date.now() - 120_000);
  const tab = await newTab();
  tab.schedule(0, { ifStale: 60_000 }); // Back on the tab: a reception.
  tab.flush();
  expect(server.requests).toEqual([]);
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => {
    expect(server.requests).toEqual(["GET", "PUT"]);
  });
});

test("the server refusing again and again: a change, or the page hidden, does not hasten the next retry", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await enable();
  const tab = await newTab();
  server.busyFor(10);
  expect(await tab.sync({ asked: true })).toBe(false); // 1st refusal: retried after 15 s.
  await vi.advanceTimersByTimeAsync(15_000); // 2nd: after 15 s.
  await vi.advanceTimersByTimeAsync(15_000); // 3rd: told, retried after 30 s.
  await vi.waitFor(() => {
    expect(tab.status).toBe("error");
  });
  expect(server.requests).toHaveLength(3);
  tab.changed();
  tab.flush();
  await vi.advanceTimersByTimeAsync(29_000);
  expect(server.requests).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(1_000);
  await vi.waitFor(() => {
    expect(server.requests).toHaveLength(4);
  });
});
