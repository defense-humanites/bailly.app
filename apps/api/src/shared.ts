/**
 * A value shared by the requests of a process or an isolate, initialized by the first
 * request that needs it (the derived data of the dictionary, the Morpheus instance).
 *
 * On Cloudflare Workers, a promise created by one request and awaited by another
 * never settles if the first request is canceled before it does: its I/O (a D1 query)
 * belongs to that request, and dies with it. The front end cancels a search as soon
 * as the next keystroke supersedes it; the request that had started loading the
 * derived data could thus leave it pending forever, and every later search of the
 * isolate waited for it (production, 4 November 2026). Hence:
 *
 *   - the value, once there, is kept as such, not as a promise;
 *   - a request that waits for another request's initialization gives up after
 *     `patience` ms, drops it if it is still the current one, and starts its own (a
 *     slow but live initialization may then run twice: the first result is kept).
 *
 * On Node.js, nothing is ever canceled that way: the patience is never exhausted.
 */
export class Shared<T> {
  readonly #init: () => Promise<T>;
  readonly #patience: number;
  #value: { readonly value: T } | undefined;
  #pending: Promise<T> | undefined;

  constructor(init: () => Promise<T>, { patience = 2_000 } = {}) {
    this.#init = init;
    this.#patience = patience;
  }

  async get(): Promise<T> {
    while (true) {
      if (this.#value) return this.#value.value;

      const pending = this.#pending;
      // No initialization under way: this request starts one and waits for it (its
      // own request is alive as long as it waits).
      if (!pending) return this.#start();

      const settled = await settleWithin(pending, this.#patience);
      if (settled) return settled.value;

      // Stale (presumably that of a canceled request): start afresh.
      if (this.#pending === pending) this.#pending = undefined;
    }
  }

  /** Forgets the value (e.g. a Morpheus instance left unusable by an abort). */
  reset(): void {
    this.#value = undefined;
    this.#pending = undefined;
  }

  #start(): Promise<T> {
    const pending: Promise<T> = this.#init().then(
      (value) => {
        this.#value ??= { value };
        if (this.#pending === pending) this.#pending = undefined;
        return this.#value.value;
      },
      (error: unknown) => {
        // A failed initialization is retried by the next request.
        if (this.#pending === pending) this.#pending = undefined;
        throw error;
      }
    );
    this.#pending = pending;
    return pending;
  }
}

/** The outcome of `promise` if it settles within `ms`, `undefined` otherwise. */
async function settleWithin<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ value: T } | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });

  try {
    return await Promise.race([promise.then((value) => ({ value })), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
