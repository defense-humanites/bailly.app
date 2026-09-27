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

export type LockerContent = { version: number; blob: string };
export type StoreResult = { state: "written"; version: number } | { state: "conflict"; version: number };

type Fetch = typeof fetch;

async function request(fetcher: Fetch, { lockerId, token }: SyncCredentials, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetcher(`/api/sync/${lockerId}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new SyncNetworkError();
  }
}

function unexpected(response: Response): never {
  if (response.status === 410) throw new LockerDeletedError();
  if (response.status === 429) throw new SyncBusyError();
  throw new SyncNetworkError(`Le serveur de synchronisation a répondu par une erreur (${response.status}).`);
}

/**
 * Reads the locker.
 * @returns Its content, or `null` if it does not exist (yet, or anymore:
 * idle lockers are purged).
 */
export async function fetchLocker(credentials: SyncCredentials, fetcher: Fetch = fetch): Promise<LockerContent | null> {
  const response = await request(fetcher, credentials);
  if (response.status === 404) return null;
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
  fetcher: Fetch = fetch,
): Promise<StoreResult> {
  const response = await request(fetcher, credentials, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version, blob }),
  });

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
export async function removeLocker(credentials: SyncCredentials, fetcher: Fetch = fetch): Promise<void> {
  const response = await request(fetcher, credentials, { method: "DELETE" });
  if (!response.ok && response.status !== 404) unexpected(response);
}
