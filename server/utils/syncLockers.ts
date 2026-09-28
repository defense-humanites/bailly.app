import { createError, getRequestHeader, getRequestIP, readRawBody, type H3Event } from "h3";
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

/**
 * Reads a JSON body of at most `maxBytes`: a `Content-Length` is required
 * (browsers send it for a body of known size, as the Fetch standard says),
 * and checked before the body is read; the connection's framing then keeps
 * the body within it. A chunked body, whose size is unknown until read, is
 * refused rather than read.
 * @throws A 411 error without `Content-Length`, a 413 error if the body is
 * too large, a 400 error if it is not JSON.
 */
export async function readBoundedJson(event: H3Event, maxBytes: number): Promise<unknown> {
  const header = getRequestHeader(event, "content-length");
  const length = header === undefined ? Number.NaN : Number(header);
  if (!Number.isInteger(length) || length < 0) throw createError({ statusCode: 411 });
  if (length > maxBytes) throw createError({ statusCode: 413 });

  const raw = await readRawBody(event, false);
  if (raw && raw.byteLength > maxBytes) throw createError({ statusCode: 413 });

  try {
    return JSON.parse(raw ? new TextDecoder().decode(raw) : "") as unknown;
  } catch {
    throw createError({ statusCode: 400 });
  }
}

/**
 * The address of the client, for its daily budget (cf. `server/lib/syncBudget.ts`):
 * from the header set by the proxy in front of the server if one is
 * configured (`CF-Connecting-IP` on Cloudflare), from the connection
 * otherwise. A header is only trusted when configured: a client could set
 * any value. In a list (e.g. `X-Forwarded-For`), the last address is the one
 * the proxy added.
 */
export function requestAddress(event: H3Event): string | undefined {
  const header = useRuntimeConfig(event).sync.addressHeader;
  if (!header && !proxyWarned && getRequestHeader(event, "x-forwarded-for")) {
    // Behind a proxy, the connection's address is the proxy's: all the
    // clients would share one budget.
    proxyWarned = true;
    console.warn("The server seems to be behind a proxy (X-Forwarded-For): set NUXT_SYNC_ADDRESS_HEADER, so that the budgets of the synchronization count each client.");
  }
  const value = header ? getRequestHeader(event, header)?.split(",").at(-1)?.trim() : undefined;
  return value || getRequestIP(event);
}

let proxyWarned = false;
