import { beforeEach, expect, test } from "vitest";
import { InputMode, LegacyStorageKey } from "../../app/enums";
import { takeLegacyStorage } from "../../app/utils/legacyStorage";
import { parsePreferences } from "../../app/utils/preferences";

beforeEach(() => {
  localStorage.clear();
});

test("parsePreferences keeps the valid preferences only", () => {
  expect(parsePreferences({ inputMode: "transliteration", inflectedForms: false, transliterateGreek: true }))
    .toEqual({ inputMode: InputMode.Transliteration, inflectedForms: false, transliterateGreek: true });
  expect(parsePreferences({ inputMode: "morse", inflectedForms: "no", other: 1 })).toEqual({});
  expect(parsePreferences("garbage")).toEqual({});
  expect(parsePreferences(undefined)).toEqual({});
});

test("takeLegacyStorage: nothing to migrate", () => {
  expect(takeLegacyStorage(localStorage)).toBeNull();
});

test("takeLegacyStorage migrates the Astro app's keys, then removes them", () => {
  localStorage.setItem(LegacyStorageKey.SearchInputMode, "transliteration");
  localStorage.setItem(LegacyStorageKey.SearchSkipLemmatization, "true");
  localStorage.setItem(LegacyStorageKey.EnableGreekRomanization, "true");
  localStorage.setItem(LegacyStorageKey.Theme, "dark");
  localStorage.setItem(LegacyStorageKey.CurrentTagKey, "3");
  localStorage.setItem(LegacyStorageKey.DismissSearchBarMorphologicalResultsWarning, "true");
  localStorage.setItem(LegacyStorageKey.HistoryLength, "20");
  localStorage.setItem("unrelated", "kept");

  expect(takeLegacyStorage(localStorage)).toEqual({
    preferences: { inputMode: InputMode.Transliteration, inflectedForms: false, transliterateGreek: true },
    theme: "dark",
    currentTag: 3,
    dismissed: ["morpheusWarning"],
  });
  expect(Object.keys(localStorage)).toEqual(["unrelated"]);
});

test("takeLegacyStorage: the default values set nothing", () => {
  localStorage.setItem(LegacyStorageKey.SearchInputMode, "betaCode");
  localStorage.setItem(LegacyStorageKey.SearchSkipLemmatization, "false");
  localStorage.setItem(LegacyStorageKey.EnableGreekRomanization, "false");
  localStorage.setItem(LegacyStorageKey.CurrentTagKey, "null");

  expect(takeLegacyStorage(localStorage)).toEqual({ preferences: {}, dismissed: [] });
  expect(localStorage.length).toBe(0);
});

test("parsePreferences: the bookmarks page's display and sorting", () => {
  expect(parsePreferences({ bookmarksDisplay: "headwords", tagSort: "recent" })).toEqual({ bookmarksDisplay: "headwords", tagSort: "recent" });
  expect(parsePreferences({ bookmarksDisplay: "grid", tagSort: "color" })).toEqual({});
});
