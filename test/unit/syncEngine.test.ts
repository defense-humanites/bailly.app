// @vitest-environment node
import { createDatabase, type Database } from "db0";
import sqlite from "db0/connectors/node-sqlite";
import { beforeEach, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import { emptyState, mergeStates, normalize, type BookmarksState } from "../../app/idb/merge";
import { deriveCredentials, type SyncCredentials } from "../../app/sync/crypto";
import { synchronize, type SyncDependencies } from "../../app/sync/engine";
import { deleteLocker, hashToken, readLocker, resetSchemaCache, writeLocker } from "../../server/lib/lockers";
import { LockerDeletedError, SyncBusyError } from "../../app/sync/lockerClient";

/**
 * A stand-in for the server routes (`server/api/sync/[id]`), on an in-memory
 * database.
 */
function fakeServer(db: Database, { beforeWrite }: { beforeWrite?: () => Promise<void> } = {}): typeof fetch {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const id = url.split("/").pop()!;
    const token = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
    const hash = await hashToken(token);

    if (!init?.method || init.method === "GET") {
      const result = await readLocker(db, id, hash);
      if (result.state === "found") return json(200, { version: result.version, blob: result.blob });
      return json(result.state === "deleted" ? 410 : 404, {});
    }
    if (init.method === "PUT") {
      await beforeWrite?.();
      const { version, blob } = JSON.parse(init.body as string) as { version: number; blob: string };
      const result = await writeLocker(db, id, hash, version, blob);
      if (result.state === "written") return json(200, { version: result.version });
      if (result.state === "conflict") return json(412, { data: { version: result.version } });
      return json(result.state === "deleted" ? 410 : 404, {});
    }
    return json(405, {});
  };
}

/**
 * A device: its bookmarks (in memory) and the dependencies of the engine.
 */
function device(server: typeof fetch, initial: BookmarksState = emptyState()) {
  let state = initial;
  const deps: SyncDependencies = {
    readState: () => Promise.resolve(state),
    mergeState: (remote) => {
      state = normalize(mergeStates(state, remote));
      return Promise.resolve(state);
    },
    fetch: server,
  };
  return {
    deps,
    get state() {
      return state;
    },
    change(update: (state: BookmarksState) => BookmarksState) {
      state = update(state);
    },
  };
}

// Recent stamps: older tombstones are not uploaded (cf. `compact`).
let time = Date.now();
const stamp = () => formatStamp({ time: time++, counter: 0, node: "t" });
const star = (uri: string, deleted?: true) => ({ uri, word: uri, excerpt: "", updatedAt: stamp(), ...(deleted ? { deleted } : {}) });
const addStar = (uri: string, deleted?: true) => (state: BookmarksState) => mergeStates(state, { ...emptyState(), starred: [star(uri, deleted)] });
const liveStars = (state: BookmarksState) => state.starred.filter(record => !record.deleted).map(record => record.uri);

let db: Database;
let credentials: SyncCredentials;

beforeEach(async () => {
  resetSchemaCache();
  db = createDatabase(sqlite({ name: ":memory:" }));
  credentials = await deriveCredentials(new Uint8Array(16).fill(3));
});

test("two devices converge through the locker", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  const phone = device(server);

  laptop.change(addStar("logos"));
  expect(await synchronize(credentials, laptop.deps)).toBe(1); // Created.
  expect(await synchronize(credentials, phone.deps)).toBe(1); // Nothing to write.
  expect(liveStars(phone.state)).toEqual(["logos"]);

  // Concurrent changes, offline.
  phone.change(addStar("logos", true));
  laptop.change(addStar("psukhe"));
  await synchronize(credentials, phone.deps);
  await synchronize(credentials, laptop.deps);
  await synchronize(credentials, phone.deps);

  expect(liveStars(laptop.state)).toEqual(["psukhe"]);
  expect(phone.state).toEqual(laptop.state);

  // The server only holds ciphertext.
  const locker = await readLocker(db, credentials.lockerId, await hashToken(credentials.token));
  expect(locker.state === "found" && locker.blob.includes("psukhe")).toBe(false);
});

test("a write by another device between the read and the write: merged, then written", async () => {
  const otherDevice = device(fakeServer(db));
  let interfere = true;
  const server = fakeServer(db, {
    beforeWrite: async () => {
      if (!interfere) return;
      interfere = false;
      otherDevice.change(addStar("anthropos"));
      await synchronize(credentials, otherDevice.deps);
    },
  });

  const laptop = device(server);
  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);

  expect(liveStars(laptop.state).sort()).toEqual(["anthropos", "logos"]);
  await synchronize(credentials, otherDevice.deps);
  expect(otherDevice.state).toEqual(laptop.state);
});

test("a purged locker is recreated; a deleted one stops the devices", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);

  // Purged (as after 18 months unchanged).
  await db.sql`DELETE FROM sync_lockers`;
  expect(await synchronize(credentials, laptop.deps)).toBe(1);

  await deleteLocker(db, credentials.lockerId, await hashToken(credentials.token));
  await expect(synchronize(credentials, laptop.deps)).rejects.toBeInstanceOf(LockerDeletedError);
});

test("a locker that cannot be decrypted makes the synchronization fail", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  await synchronize(credentials, laptop.deps);

  // The same locker read with another encryption key.
  const other = await deriveCredentials(new Uint8Array(16).fill(4));
  await expect(synchronize({ ...credentials, key: other.key }, laptop.deps)).rejects.toThrow();
});

test("too many requests (rate limiting): an error to retry later", async () => {
  const limited: typeof fetch = () => Promise.resolve(new Response("", { status: 429 }));
  await expect(synchronize(credentials, device(limited).deps)).rejects.toBeInstanceOf(SyncBusyError);
});
