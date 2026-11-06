import { expect, test } from "vitest";
import { emptyState } from "../../app/idb/merge";
import {
  bookmarksSection,
  knownSections,
  LOCKER_FORMAT,
  MAX_SECTIONS,
  parseLocker,
  readBookmarksSection,
  serializeLocker,
  SyncFormatError,
  SyncOutdatedError,
} from "../../app/sync/locker";

const envelope = (sections: unknown, version = 1) => JSON.stringify({ format: LOCKER_FORMAT, version, sections });

test("an envelope round-trips, its sections as they are", () => {
  const sections = { bookmarks: bookmarksSection(emptyState()), history: { version: 4, any: ["thing"] } };
  expect(parseLocker(serializeLocker(sections))).toEqual(sections);
});

test("what is not an envelope of this version is refused", () => {
  expect(() => parseLocker("not json")).toThrow(SyncFormatError);
  expect(() => parseLocker(JSON.stringify({ format: "bailly-bookmarks", version: 1, state: emptyState() }))).toThrow(SyncFormatError);
  expect(() => parseLocker(JSON.stringify({ format: LOCKER_FORMAT, version: 1 }))).toThrow(SyncFormatError);
  expect(() => parseLocker(envelope({}, 2))).toThrow(/version plus récente/);
});

test("invalid sections are left out, and at most 8 are kept, the known ones first", () => {
  expect(parseLocker(envelope({ a: 1, b: { version: 0 }, c: { version: 1.5 }, d: [], e: { version: 1 } }))).toEqual({ e: { version: 1 } });

  const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`s${String(i).padStart(2, "0")}`, { version: 1 }]));
  const kept = parseLocker(envelope({ ...many, bookmarks: bookmarksSection(emptyState()) }));
  expect(Object.keys(kept)).toHaveLength(MAX_SECTIONS);
  expect(Object.keys(kept)[0]).toBe("bookmarks");
  expect(Object.keys(kept).slice(1)).toEqual(["s00", "s01", "s02", "s03", "s04", "s05", "s06"]);
});

test("the bookmarks section: empty when missing, refused when written by a later version", () => {
  expect(readBookmarksSection({})).toEqual(emptyState());
  expect(() => readBookmarksSection({ bookmarks: { version: 2, state: emptyState() } })).toThrow(SyncOutdatedError);
  expect(knownSections({ bookmarks: { version: 1 }, history: { version: 1 } })).toEqual({ bookmarks: { version: 1 } });
});
