import type { H3Event } from "h3";
import { hashToken, LOCKER_ID_PATTERN, TOKEN_PATTERN } from "../lib/lockers";

/**
 * The database of the synchronization lockers (cf. `nitro.database` in
 * `nuxt.config.ts`).
 */
export const useLockersDatabase = () => useDatabase("bookmarksSync");

/**
 * The locker id and the hash of the token of a request.
 * @throws A 404 error for an invalid id, a 401 error without a valid token.
 */
export async function lockerRequest(event: H3Event): Promise<{ id: string; tokenHash: string }> {
  // The responses concern one device and change constantly.
  setResponseHeader(event, "Cache-Control", "no-store");

  const id = getRouterParam(event, "id") ?? "";
  if (!LOCKER_ID_PATTERN.test(id)) throw createError({ statusCode: 404 });

  const token = /^Bearer (.+)$/.exec(getRequestHeader(event, "authorization") ?? "")?.[1] ?? "";
  if (!TOKEN_PATTERN.test(token)) throw createError({ statusCode: 401 });

  return { id, tokenHash: await hashToken(token) };
}
