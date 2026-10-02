// @vitest-environment node
import { createDatabase, type Database } from "db0";
import sqlite from "db0/connectors/node-sqlite";
import { beforeEach, expect, test } from "vitest";
import { formatStamp } from "../../app/idb/clock";
import { emptyState, joinRecords, mergeStates, normalize, withoutTombstones, type BookmarksState } from "../../app/idb/merge";
import { decryptText, deriveCredentials, encryptText, type SyncCredentials } from "../../app/sync/crypto";
import { parseLocker, readBookmarksSection, serializeLocker, SyncFormatError, SyncOutdatedError, type LockerSections } from "../../app/sync/locker";
import { mergePreferenceRecords, type PreferenceRecord, type PreferenceValue } from "../../app/idb/preferenceRecords";
import type { SyncablePreference } from "../../app/utils/preferences";
import { lockerBlob, synchronize, SyncLimitError, SyncPartialError, SyncTooLargeError, type BookmarksDependencies, type PreferencesDependencies, type SyncDependencies } from "../../app/sync/engine";
import { DAY, deleteLocker, hashToken, IDLE_MAX_DAYS, purgeLockers, readLocker, resetSchemaCache, writeLocker } from "../../server/lib/lockers";
import { LockerDeletedError, SyncBusyError, SyncQuotaError, SyncTimeoutError } from "../../app/sync/lockerClient";

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
      if (result.state === "empty") return new Response(null, { status: 204 });
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
  const deps: SyncDependencies & { bookmarks: BookmarksDependencies } = {
    bookmarks: {
      readState: () => Promise.resolve(state),
      mergeState: (remote) => {
        state = normalize(mergeStates(state, remote));
        return Promise.resolve(state);
      },
      joinState: (remote) => {
        state = normalize(mergeStates(withoutTombstones(state), joinRecords(state, remote, stamp())));
        return Promise.resolve(state);
      },
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
const star = (uri: string, deleted?: true) => ({ uri, word: uri, updatedAt: stamp(), ...(deleted ? { deleted } : {}) });
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

  // Emptied (as after 18 months without access), then filled again by the
  // first device, which the second merges.
  await purgeLockers(db, Date.now() + (IDLE_MAX_DAYS + 1) * DAY);
  const phone = device(server);
  phone.change(addStar("psukhe"));
  expect(await synchronize(credentials, phone.deps)).toBe(2);
  expect(await synchronize(credentials, laptop.deps)).toBe(3);
  expect(liveStars(laptop.state)).toEqual(["logos", "psukhe"]);

  // Deleted (as after 3 years without access).
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

test("a device joining a locker the server emptied: its earlier deletions do not apply elsewhere", async () => {
  const server = fakeServer(db);
  const phone = device(server);
  phone.change(addStar("logos"));
  await synchronize(credentials, phone.deps, { first: true });

  // Emptied (the phone did not come back), while the laptop, outside this
  // synchronization, had deleted the same entry.
  await purgeLockers(db, Date.now() + (IDLE_MAX_DAYS + 1) * DAY);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  laptop.change(addStar("logos", true));
  laptop.change(addStar("psukhe"));
  await synchronize(credentials, laptop.deps, { first: true });
  expect(laptop.state.starred.some(record => record.deleted)).toBe(false);

  await synchronize(credentials, phone.deps);
  expect(liveStars(phone.state)).toEqual(["logos", "psukhe"]);
});

test("a first synchronization into an empty locker that fails keeps the device's deletions", async () => {
  const laptop = device(() => Promise.resolve(new Response(null, { status: 404 })));
  laptop.change(addStar("logos"));
  laptop.change(addStar("logos", true));
  await expect(synchronize(credentials, laptop.deps, { first: true })).rejects.toThrow();
  expect(laptop.state.starred.some(record => record.deleted)).toBe(true);
});

test("read only (the daily budget spent): the locker is merged here, nothing is sent", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  const phone = device(server);
  // Nothing online yet: nothing created.
  laptop.change(addStar("logos"));
  expect(await synchronize(credentials, laptop.deps, { readOnly: true })).toBe(0);
  expect(await readLocker(db, credentials.lockerId, await hashToken(credentials.token))).toEqual({ state: "missing" });

  await synchronize(credentials, laptop.deps);
  phone.change(addStar("psukhe"));
  expect(await synchronize(credentials, phone.deps, { readOnly: true })).toBe(1);
  expect(liveStars(phone.state)).toEqual(["logos", "psukhe"]);
  expect(await readLocker(db, credentials.lockerId, await hashToken(credentials.token))).toMatchObject({ version: 1 });
});

test("filling again an emptied locker is reported", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  let refilled = 0;
  await synchronize(credentials, laptop.deps, { onRefilled: () => refilled++ });
  expect(refilled).toBe(0); // Created, not filled again.

  await purgeLockers(db, Date.now() + (IDLE_MAX_DAYS + 1) * DAY);
  await synchronize(credentials, laptop.deps, { onRefilled: () => refilled++ });
  expect(refilled).toBe(1);
});

test("too many requests (rate limiting): an error to retry later", async () => {
  const limited: typeof fetch = () => Promise.resolve(new Response("", { status: 429 }));
  await expect(synchronize(credentials, device(limited).deps)).rejects.toBeInstanceOf(SyncBusyError);
});

test("the daily budget spent (of the address or of the server): an error of its own, with its delay", async () => {
  const exhausted = (reason: string): typeof fetch => (_input, init) => Promise.resolve(!init?.method || init.method === "GET"
    ? new Response(null, { status: 404 })
    : new Response(JSON.stringify({ statusCode: 429, data: { reason } }), { status: 429, headers: { "Retry-After": "3600" } }));

  const address = await synchronize(credentials, device(exhausted("daily-budget")).deps).catch((e: unknown) => e);
  expect(address).toBeInstanceOf(SyncQuotaError);
  expect((address as SyncQuotaError).retryAfter).toBe(3600);
  expect((address as SyncQuotaError).message).toMatch(/depuis ce réseau/);

  const server = await synchronize(credentials, device(exhausted("server-budget")).deps).catch((e: unknown) => e);
  expect((server as SyncQuotaError).message).toMatch(/Le serveur de synchronisation a reçu trop de signets/);
});

test("a device joining (again) does not delete online what it deleted meanwhile", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  const phone = device(server);

  laptop.change(addStar("logos"));
  laptop.change(addStar("psukhe"));
  await synchronize(credentials, laptop.deps);
  await synchronize(credentials, phone.deps, { first: true });

  // The phone disables the synchronization, then deletes a favorite and adds
  // another; meanwhile, the laptop deletes one.
  phone.change(addStar("logos", true));
  phone.change(addStar("anthropos"));
  laptop.change(addStar("psukhe", true));
  await synchronize(credentials, laptop.deps);

  // Joining again: logos comes back, psukhe stays deleted, anthropos is sent.
  await synchronize(credentials, phone.deps, { first: true });
  await synchronize(credentials, laptop.deps);
  expect(liveStars(phone.state).sort()).toEqual(["anthropos", "logos"]);
  expect(laptop.state).toEqual(phone.state);

  // Afterwards, a deletion on the phone reaches the laptop again.
  phone.change(addStar("anthropos", true));
  await synchronize(credentials, phone.deps);
  await synchronize(credentials, laptop.deps);
  expect(liveStars(laptop.state)).toEqual(["logos"]);
});

test("a cancelled synchronization aborts its requests, and merges nothing afterwards", async () => {
  const laptop = device(fakeServer(db));
  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);

  // A server that answers only when the request is aborted.
  const hanging: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  const phone = device(hanging);
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, 20);
  await expect(synchronize(credentials, phone.deps, { signal: controller.signal })).rejects.toBeInstanceOf(SyncTimeoutError);

  // Aborted after the locker was read: nothing is merged.
  const merged: string[] = [];
  const phone2 = device(fakeServer(db));
  const aborted = new AbortController();
  const deps = {
    ...phone2.deps,
    bookmarks: {
      ...phone2.deps.bookmarks,
      mergeState: (state: BookmarksState) => {
        merged.push("merged");
        return phone2.deps.bookmarks.mergeState(state);
      },
    },
    fetch: (async (input, init) => {
      const response = await fakeServer(db)(input, init);
      aborted.abort();
      return response;
    }) as typeof fetch,
  };
  await expect(synchronize(credentials, deps, { signal: aborted.signal })).rejects.toBeInstanceOf(SyncTimeoutError);
  expect(merged).toEqual([]);
});

test("a content too large leaves out the older tombstones first, then is refused", async () => {
  const day = 24 * 60 * 60 * 1000;
  const tombstone = (uri: string, age: number) =>
    ({ uri, word: "", updatedAt: formatStamp({ time: Date.now() - age, counter: 0, node: "t" }), deleted: true as const });
  const state: BookmarksState = {
    ...emptyState(),
    starred: [
      star("logos"),
      tombstone("recent", day),
      ...Array.from({ length: 300 }, (_, i) => tombstone(`older-${i}-${Math.random().toString(36).slice(2)}`, 40 * day)),
    ],
  };

  const full = await lockerBlob(state, credentials);
  const withoutOlder = await lockerBlob({ ...state, starred: state.starred.slice(0, 2) }, credentials);
  expect(withoutOlder.length).toBeLessThan(full.length);

  // Within a smaller limit: the tombstones older than 30 days are left out.
  const blob = await lockerBlob(state, credentials, withoutOlder.length + 10);
  expect(readBookmarksSection(parseLocker(await decryptText(blob, credentials))).starred.map(record => record.uri)).toEqual(["logos", "recent"]);

  // Too large even without tombstones.
  await expect(lockerBlob(state, credentials, 100)).rejects.toThrow(SyncTooLargeError);
});

test("a merge beyond the limits stops the synchronization: nothing is written", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  expect(await synchronize(credentials, laptop.deps)).toBe(1);

  const phone = device(server);
  phone.change(addStar("psukhe"));
  const refused = { ...phone.deps, bookmarks: { ...phone.deps.bookmarks, mergeState: () => Promise.reject(new SyncLimitError("Limites dépassées.")) } };
  const error = await synchronize(credentials, refused).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SyncPartialError);
  expect((error as SyncPartialError).cause).toBeInstanceOf(SyncLimitError);
  expect(liveStars(phone.state)).toEqual(["psukhe"]);
  expect(await synchronize(credentials, laptop.deps)).toBe(1); // The locker did not change.
});

/**
 * Writes a locker's content directly (e.g. as a later version would).
 */
async function writeContent(content: string, version = 0): Promise<void> {
  const blob = await encryptText(content, credentials);
  const result = await writeLocker(db, credentials.lockerId, await hashToken(credentials.token), version, blob);
  expect(result.state).toBe("written");
}

async function readContent(): Promise<LockerSections> {
  const locker = await readLocker(db, credentials.lockerId, await hashToken(credentials.token));
  if (locker.state !== "found") throw new Error(locker.state);
  return parseLocker(await decryptText(locker.blob, credentials));
}

test("the sections of other types are written back as they are", async () => {
  const history = { version: 3, entries: ["logos", "psuchê"] };
  await writeContent(serializeLocker({ history }));

  const laptop = device(fakeServer(db));
  laptop.change(addStar("logos"));
  expect(await synchronize(credentials, laptop.deps)).toBe(2);
  const sections = await readContent();
  expect(sections.history).toEqual(history);
  expect(Object.keys(sections).sort()).toEqual(["bookmarks", "history"]);
});

test("a locker without bookmarks: they are added, the other sections kept", async () => {
  const preferences = { version: 1, records: [] };
  await writeContent(serializeLocker({ preferences }));

  const phone = device(fakeServer(db));
  expect(await synchronize(credentials, phone.deps, { first: true })).toBe(1); // Nothing to add.
  phone.change(addStar("logos"));
  expect(await synchronize(credentials, phone.deps)).toBe(2);
  expect((await readContent()).preferences).toEqual(preferences);
});

test("bookmarks written by a later version: not merged nor overwritten", async () => {
  const later = { version: 2, state: { tags: [], tagged: [], starred: [], future: true } };
  await writeContent(serializeLocker({ bookmarks: later }));

  const laptop = device(fakeServer(db));
  laptop.change(addStar("logos"));
  const error = await synchronize(credentials, laptop.deps).catch((e: unknown) => e);
  expect(error).toMatchObject({ section: "bookmarks" });
  expect((error as SyncPartialError).cause).toBeInstanceOf(SyncOutdatedError);
  expect((error as Error).message).toMatch(/rechargez la page/);
  expect((await readContent()).bookmarks).toEqual(later);
});

test("a locker of a later or unknown format stops the synchronization, untouched", async () => {
  await writeContent(JSON.stringify({ format: "bailly-sync", version: 2, sections: {} }));
  const laptop = device(fakeServer(db));
  laptop.change(addStar("logos"));
  await expect(synchronize(credentials, laptop.deps)).rejects.toThrow(/version plus récente/);

  await db.sql`DELETE FROM sync_lockers`;
  await writeContent(JSON.stringify({ format: "bailly-bookmarks", version: 1, state: emptyState() }));
  await expect(synchronize(credentials, laptop.deps)).rejects.toBeInstanceOf(SyncFormatError);
});

test("a locker too large: the sections of other types are left out before the bookmarks fail", async () => {
  const state = { ...emptyState(), starred: [star("logos")] };
  const unknown = { version: 1, padding: Array.from({ length: 400 }, () => Math.random().toString(36).slice(2)).join("") };
  const alone = await lockerBlob(state, credentials);
  const blob = await lockerBlob(state, credentials, alone.length + 100, { unknown });
  const sections = parseLocker(await decryptText(blob, credentials));
  expect(Object.keys(sections)).toEqual(["bookmarks"]);

  // Within the limit, kept.
  const roomy = await lockerBlob(state, credentials, undefined, { unknown });
  expect(parseLocker(await decryptText(roomy, credentials)).unknown).toEqual(unknown);
});

/**
 * A device's preferences (in memory): their records, and the values applied.
 */
function preferencesOf(keys: SyncablePreference[]) {
  let records: PreferenceRecord[] = [];
  const applied: Record<string, unknown> = {};
  const deps: PreferencesDependencies = {
    keys,
    readRecords: () => Promise.resolve(records),
    mergeRecords: (received) => {
      records = mergePreferenceRecords(records, received);
      for (const record of records) applied[record.key] = record.value;
      return Promise.resolve(records);
    },
  };
  return {
    deps,
    applied,
    get records() {
      return records;
    },
    set(key: string, value: PreferenceValue) {
      records = mergePreferenceRecords(records, [{ key, value, updatedAt: stamp() }]);
      applied[key] = value;
    },
  };
}

test("the preferences: each device sends and receives those it synchronizes", async () => {
  const server = fakeServer(db);
  const laptop = preferencesOf(["readingFont", "transliterateGreek", "inputMode"]);
  const phone = preferencesOf(["readingFont", "transliterateGreek"]);

  laptop.set("readingFont", "didot");
  laptop.set("inputMode", "transliteration");
  expect(await synchronize(credentials, { preferences: laptop.deps, fetch: server })).toBe(1); // Created.
  phone.set("transliterateGreek", true);
  phone.set("inputMode", "betaCode"); // Not synchronized on the phone.
  expect(await synchronize(credentials, { preferences: phone.deps, fetch: server })).toBe(2);
  expect(phone.applied).toMatchObject({ readingFont: "didot", transliterateGreek: true, inputMode: "betaCode" });

  await synchronize(credentials, { preferences: laptop.deps, fetch: server });
  expect(laptop.applied).toMatchObject({ readingFont: "didot", transliterateGreek: true, inputMode: "transliteration" });

  // The input mode of the laptop stays online, untouched by the phone.
  const online = (await readContent()).preferences as unknown as { records: PreferenceRecord[] };
  expect(online.records.find(record => record.key === "inputMode")?.value).toBe("transliteration");
});

test("a device that synchronizes its bookmarks only keeps the preferences online, and the reverse", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  const phone = device(server);
  const phonePreferences = preferencesOf(["readingFont"]);

  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);
  phonePreferences.set("readingFont", "bodoni");
  await synchronize(credentials, { preferences: phonePreferences.deps, fetch: server }, { first: true });

  // The laptop writes its bookmarks: the preferences stay.
  laptop.change(addStar("psukhe"));
  await synchronize(credentials, laptop.deps);
  expect((await readContent()).preferences).toMatchObject({ records: [{ key: "readingFont", value: "bodoni" }] });

  // The phone writes its preferences: the bookmarks stay, unread.
  phonePreferences.set("readingFont", "didot");
  await synchronize(credentials, { preferences: phonePreferences.deps, fetch: server });
  await synchronize(credentials, phone.deps);
  expect(liveStars(phone.state)).toEqual(["logos", "psukhe"]);
  expect((await readContent()).preferences).toMatchObject({ records: [{ key: "readingFont", value: "didot" }] });
});

test("a type that cannot be merged does not stop the other: its section stays, its error comes after", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);

  const phone = device(server);
  const phonePreferences = preferencesOf(["readingFont"]);
  phonePreferences.set("readingFont", "didot");
  const refused = {
    bookmarks: { ...phone.deps.bookmarks, mergeState: () => Promise.reject(new SyncLimitError("Limites dépassées.")) },
    preferences: phonePreferences.deps,
    fetch: server,
  };
  const merged: string[] = [];
  const error = await synchronize(credentials, refused, { onMerged: types => merged.push(...types) }).catch((e: unknown) => e);
  expect((error as SyncPartialError).cause).toBeInstanceOf(SyncLimitError);
  // The preferences merged (e.g. an activation keeps the key), the bookmarks not.
  expect(merged).toEqual(["preferences"]);
  const sections = await readContent();
  expect(sections.preferences).toMatchObject({ records: [{ key: "readingFont", value: "didot" }] });
  expect(readBookmarksSection(sections).starred.map(record => record.uri)).toEqual(["logos"]);
});

test("the records of preferences unknown to this version are passed on", async () => {
  const later = { key: "laterPreference", value: "on", updatedAt: stamp() };
  await writeContent(serializeLocker({ preferences: { version: 1, records: [later] } }));
  const phone = preferencesOf(["readingFont"]);
  phone.set("readingFont", "didot");
  await synchronize(credentials, { preferences: phone.deps, fetch: fakeServer(db) });
  expect(phone.applied).not.toHaveProperty("laterPreference");
  expect((await readContent()).preferences).toEqual({ version: 1, records: mergePreferenceRecords([later], phone.records) });
});

test("one reference time for every type: a device that synchronizes its preferences only accepts what the others do", async () => {
  const server = fakeServer(db);
  // A record stamped ahead of this device's clock, but not of the latest
  // stamp it observed.
  const ahead = { key: "inputMode", value: "transliteration", updatedAt: formatStamp({ time: Date.now() + 30 * 60 * 60 * 1000, counter: 0, node: "z" }) };
  await writeContent(serializeLocker({ preferences: { version: 1, records: [ahead] } }));
  const phone = preferencesOf(["readingFont"]);
  phone.set("readingFont", "didot");
  await synchronize(credentials, { preferences: phone.deps, referenceTime: () => Promise.resolve(Date.now() + 30 * 60 * 60 * 1000), fetch: server });
  expect((await readContent()).preferences).toMatchObject({ records: [ahead, { key: "readingFont" }] });
});

test("bookmarks too large: the preferences are written all the same", async () => {
  const server = fakeServer(db);
  const laptop = device(server);
  laptop.change(addStar("logos"));
  await synchronize(credentials, laptop.deps);

  // Far too many bookmarks for a locker (even without tombstones).
  laptop.change(state => ({
    ...state,
    starred: [...state.starred, ...Array.from({ length: 6_000 }, () => star(`${crypto.randomUUID()}${crypto.randomUUID()}`))],
  }));
  const preferences = preferencesOf(["readingFont"]);
  preferences.set("readingFont", "didot");
  const error = await synchronize(credentials, { ...laptop.deps, preferences: preferences.deps }).catch((e: unknown) => e);
  expect((error as SyncPartialError).cause).toBeInstanceOf(SyncTooLargeError);
  const sections = await readContent();
  expect(sections.preferences).toMatchObject({ records: [{ key: "readingFont", value: "didot" }] });
  expect(readBookmarksSection(sections).starred.map(record => record.uri)).toEqual(["logos"]);

  // The preferences unchanged: nothing is written.
  const version = (await readLocker(db, credentials.lockerId, await hashToken(credentials.token))) as { version: number };
  const again = await synchronize(credentials, { ...laptop.deps, preferences: preferences.deps }).catch((e: unknown) => e);
  expect((again as SyncPartialError).cause).toBeInstanceOf(SyncTooLargeError);
  expect(await readLocker(db, credentials.lockerId, await hashToken(credentials.token))).toMatchObject({ version: version.version });
});

test("read only: the preferences received are merged, nothing is sent", async () => {
  const server = fakeServer(db);
  const laptop = preferencesOf(["readingFont", "transliterateGreek"]);
  laptop.set("readingFont", "didot");
  await synchronize(credentials, { preferences: laptop.deps, fetch: server });

  const phone = preferencesOf(["readingFont", "transliterateGreek"]);
  phone.set("transliterateGreek", true);
  expect(await synchronize(credentials, { preferences: phone.deps, fetch: server }, { readOnly: true })).toBe(1);
  expect(phone.applied).toMatchObject({ readingFont: "didot", transliterateGreek: true });
  expect((await readContent()).preferences).toMatchObject({ records: [{ key: "readingFont" }] });
});
