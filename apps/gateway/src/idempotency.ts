/**
 * Dropped-generation safety net.
 *
 * The app sends a `requestId`; the gateway keeps a small `Map<requestId,
 * result>` with a ~10-min TTL. On a dropped SSE, the app retries the *same*
 * `requestId` → gets the finished result back if it completed (never
 * double-charged). Node keeps the handler running after a client disconnect, so
 * completed work is cached even if `done` never reached the app.
 *
 * This is the whole "state" the gateway holds — an ephemeral safety net, not a
 * database.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // ~10 minutes
const SWEEP_INTERVAL_MS = 60 * 1000;

export class IdempotencyCache {
  private readonly store = new Map<string, Entry<unknown>>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Don't keep the process alive just for the sweeper.
    this.sweeper.unref();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  get<T>(requestId: string): T | undefined {
    const entry = this.store.get(requestId);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(requestId);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(requestId: string, value: T): void {
    this.store.set(requestId, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Return the cached result for `requestId` if present, else run `fn`, cache,
   * and return its result. `cached` tells the caller whether it was a hit (so a
   * streaming endpoint can replay instead of re-generating).
   */
  async withIdempotency<T>(
    requestId: string,
    fn: () => Promise<T>,
  ): Promise<{ cached: boolean; value: T }> {
    const existing = this.get<T>(requestId);
    if (existing !== undefined) {
      return { cached: true, value: existing };
    }
    const value = await fn();
    this.set(requestId, value);
    return { cached: false, value };
  }

  /** Test/introspection helper. */
  get size(): number {
    return this.store.size;
  }
}
