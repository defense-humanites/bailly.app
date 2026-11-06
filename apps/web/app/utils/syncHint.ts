import { PREFERENCES_COOKIE_MAX_AGE } from "~/utils/preferences";

/**
 * The types of data synchronized on this device, as the server knows them
 * (cf. `SyncButton`, `SyncCard`): the synchronization's settings are in IndexedDB, read
 * once the application is hydrated, so a cookie tells the server which
 * button to render. Without identifier, set only when the user enables the
 * synchronization (cf. `plugins/sync.client.ts`), removed when it is off.
 */
export type SyncScope = "bookmarks" | "preferences";

export const SYNC_HINT_COOKIE = "bailly-sync";

export const syncHintCookieOptions = {
  maxAge: PREFERENCES_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  // Not in development: Safari rejects secure cookies over `http://localhost`.
  secure: !import.meta.dev,
};

/**
 * Reads the cookie's value (a list of types of data), ignoring anything else.
 */
export const parseSyncHint = (value: unknown): SyncScope[] =>
  Array.isArray(value) ? value.filter((scope): scope is SyncScope => scope === "bookmarks" || scope === "preferences") : [];
