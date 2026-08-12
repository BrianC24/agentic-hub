/**
 * Per-client rate limiting for live model calls.
 *
 * A sliding window rather than a fixed one: fixed windows let a caller make a
 * full quota at 10:59 and another at 11:00, doubling the intended rate at the
 * boundary.
 *
 * In-memory, with the same multi-instance caveat as the spend ledger. It is a
 * speed bump against casual abuse, not a defence against a determined actor —
 * the spend ceiling is what actually bounds the damage.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** When the oldest request in the window expires. */
  resetsAt: number;
}

export const DEFAULT_LIMIT = 5;
export const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number = DEFAULT_LIMIT,
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Bounds memory: anyone can create keys on a public deployment. */
  private readonly maxKeys = 10_000;

  check(key: string): RateLimitResult {
    const cutoff = this.now() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetsAt: recent[0] + this.windowMs,
      };
    }

    return {
      allowed: true,
      remaining: this.limit - recent.length - 1,
      resetsAt: this.now() + this.windowMs,
    };
  }

  /** Records a use. Separate from `check` so a refused request costs nothing. */
  record(key: string): void {
    const cutoff = this.now() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    recent.push(this.now());
    this.hits.set(key, recent);

    if (this.hits.size > this.maxKeys) {
      this.evictStale(cutoff);
    }
  }

  private evictStale(cutoff: number): void {
    for (const [key, times] of this.hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length === 0) this.hits.delete(key);
      else this.hits.set(key, live);
    }
  }

  get trackedKeys(): number {
    return this.hits.size;
  }
}

/**
 * Identifies the caller.
 *
 * `x-forwarded-for` is only trustworthy because the hosting platform sets it;
 * the left-most entry is the original client. On a deployment without such a
 * proxy this header is spoofable, so every caller collapsing to "unknown" is
 * the safe failure — they share one quota rather than each getting their own.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function readLimit(): number {
  const raw = Number(process.env.LIVE_RUNS_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LIMIT;
}

const globalForLimiter = globalThis as unknown as { __agenticHubLimiter?: RateLimiter };

export const liveRateLimiter: RateLimiter =
  globalForLimiter.__agenticHubLimiter ?? new RateLimiter(readLimit());

if (!globalForLimiter.__agenticHubLimiter) {
  globalForLimiter.__agenticHubLimiter = liveRateLimiter;
}
