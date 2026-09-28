import type { SyncCredentials } from "./crypto";

/**
 * The client of the synchronization lockers (`server/api/sync/[id]`).
 */

/**
 * The locker was deleted from a device: the others stop synchronizing.
 */
export class LockerDeletedError extends Error {
  constructor() {
    super("La synchronisation a été désactivée depuis un autre appareil.");
    this.name = "LockerDeletedError";
  }
}

/**
 * The server could not be reached, or answered with an unexpected error.
 */
export class SyncNetworkError extends Error {
  constructor(message = "Le serveur de synchronisation est injoignable.") {
    super(message);
    this.name = "SyncNetworkError";
  }
}

/**
 * Too many requests from this address (the rate limiting rule of Cloudflare,
 * which blocks for 10 seconds): to retry a little later.
 */
export class SyncBusyError extends SyncNetworkError {
  constructor() {
    super("Le serveur de synchronisation est très sollicité : nouvel essai dans quelques secondes.");
    this.name = "SyncBusyError";
  }
}

/**
 * Too much sent from this network today (the daily budget of an address, cf.
 * `server/lib/syncBudget.ts`): to retry tomorrow, or from another network.
 */
export class SyncQuotaError extends SyncNetworkError {
  constructor() {
    super("Trop de signets ont été envoyés depuis ce réseau aujourd'hui : la synchronisation reprendra demain, ou depuis un autre réseau (les données mobiles, par exemple).");
    this.name = "SyncQuotaError";
  }
}

/**
 * The attempt took too long, and was cancelled.
 */
export class SyncTimeoutError extends SyncNetworkError {
  constructor() {
    super("La synchronisation n'a pas abouti dans le délai prévu.");
    this.name = "SyncTimeoutError";
  }
}

export type LockerContent = { version: number; blob: string };
/**
 * A locker emptied by the server after a long inactivity (or never accessed
 * after the day of its creation): the key is valid, the devices fill it
 * again (writing at version `0`).
 */
export const EMPTY_LOCKER = "empty";
export type StoreResult = { state: "written"; version: number } | { state: "conflict"; version: number };

export type LockerRequestOptions = {
  fetch?: typeof fetch;
  /**
   * Cancels the request (e.g. when the attempt takes too long).
   */
  signal?: AbortSignal;
  /**
   * Receives the time of the server (its `Date` header), to detect a wrong
   * clock on this device.
   */
  onServerTime?: (time: number) => void;
};

async function request(
  { lockerId, token }: SyncCredentials,
  init: RequestInit,
  { fetch: fetcher = fetch, signal, onServerTime }: LockerRequestOptions,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetcher(`/api/sync/${lockerId}`, { ...init, headers, cache: "no-store", signal });
  } catch {
    throw signal?.aborted ? new SyncTimeoutError() : new SyncNetworkError();
  }
  const time = Date.parse(response.headers.get("Date") ?? "");
  if (onServerTime && !Number.isNaN(time)) onServerTime(time);
  return response;
}

async function unexpected(response: Response): Promise<never> {
  if (response.status === 410) throw new LockerDeletedError();
  if (response.status === 429) {
    // The daily budget of the address, or the rate limiting rule of Cloudflare.
    const body = (await response.json().catch(() => ({}))) as { data?: { reason?: unknown } };
    throw body.data?.reason === "daily-budget" ? new SyncQuotaError() : new SyncBusyError();
  }
  throw new SyncNetworkError(`Le serveur de synchronisation a répondu par une erreur (${response.status}).`);
}

/**
 * Reads the locker.
 * @returns Its content; `EMPTY_LOCKER` if the server emptied it; `null` if it
 * does not exist (yet, or anymore: its row is deleted after 3 years without
 * access).
 */
export async function fetchLocker(
  credentials: SyncCredentials,
  options: LockerRequestOptions = {},
): Promise<LockerContent | typeof EMPTY_LOCKER | null> {
  const response = await request(credentials, {}, options);
  if (response.status === 404) return null;
  if (response.status === 204) return EMPTY_LOCKER;
  if (!response.ok) return unexpected(response);
  return (await response.json()) as LockerContent;
}

/**
 * Writes the locker, if it is still at the version read (`0`: creates it).
 */
export async function storeLocker(
  credentials: SyncCredentials,
  version: number,
  blob: string,
  options: LockerRequestOptions = {},
): Promise<StoreResult> {
  const response = await request(credentials, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version, blob }),
  }, options);

  if (response.ok) return { state: "written", version: ((await response.json()) as { version: number }).version };
  if (response.status === 412) {
    const body = (await response.json().catch(() => ({}))) as { data?: { version?: number } };
    return { state: "conflict", version: body.data?.version ?? -1 };
  }
  // Written at a version that no longer exists (purged meanwhile): recreated
  // at the next attempt.
  if (response.status === 404) return { state: "conflict", version: 0 };
  return unexpected(response);
}

/**
 * Deletes the content of the locker (the other devices stop synchronizing).
 */
export async function removeLocker(credentials: SyncCredentials, options: LockerRequestOptions = {}): Promise<void> {
  const response = await request(credentials, { method: "DELETE" }, options);
  if (!response.ok && response.status !== 404) await unexpected(response);
}
