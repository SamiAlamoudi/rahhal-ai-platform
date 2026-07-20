/**
 * Per-provider Rate Limiter — Sprint 56
 *
 * Queues requests and enforces token-bucket style limits to prevent provider bans.
 */

export type RateLimiterOptions = {
  /** Max requests per window. */
  maxRequests: number
  /** Window length in ms. */
  windowMs: number
  /** Max queued waiters (excess are rejected). */
  maxQueue?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export type RateLimiterStats = {
  accepted: number
  rejected: number
  queued: number
  inFlight: number
}

type Waiter = {
  resolve: () => void
  reject: (err: Error) => void
  enqueuedAt: number
}

export class ProviderRateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly maxQueue: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private timestamps: number[] = []
  private queue: Waiter[] = []
  private inFlight = 0
  private accepted = 0
  private rejected = 0
  private draining = false

  constructor(options: RateLimiterOptions) {
    this.maxRequests = Math.max(1, options.maxRequests)
    this.windowMs = Math.max(1, options.windowMs)
    this.maxQueue = options.maxQueue ?? 50
    this.now = options.now ?? (() => Date.now())
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs
    this.timestamps = this.timestamps.filter((t) => t > cutoff)
  }

  private canAccept(now: number): boolean {
    this.prune(now)
    return this.timestamps.length < this.maxRequests
  }

  private nextAvailableInMs(now: number): number {
    this.prune(now)
    if (this.timestamps.length < this.maxRequests) return 0
    const oldest = this.timestamps[0] ?? now
    return Math.max(1, oldest + this.windowMs - now)
  }

  private markAccepted(now: number): void {
    this.timestamps.push(now)
    this.accepted += 1
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      while (this.queue.length > 0) {
        const now = this.now()
        if (this.canAccept(now)) {
          const waiter = this.queue.shift()
          if (!waiter) break
          this.markAccepted(now)
          waiter.resolve()
          continue
        }
        const waitMs = this.nextAvailableInMs(now)
        await this.sleep(waitMs)
      }
    } finally {
      this.draining = false
    }
  }

  async acquire(): Promise<void> {
    const now = this.now()
    if (this.canAccept(now) && this.queue.length === 0) {
      this.markAccepted(now)
      return
    }
    if (this.queue.length >= this.maxQueue) {
      this.rejected += 1
      throw new Error('rate_limit_queue_full')
    }
    await new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject, enqueuedAt: now })
      void this.drainQueue()
    })
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    this.inFlight += 1
    try {
      return await fn()
    } finally {
      this.inFlight -= 1
      void this.drainQueue()
    }
  }

  stats(): RateLimiterStats {
    return {
      accepted: this.accepted,
      rejected: this.rejected,
      queued: this.queue.length,
      inFlight: this.inFlight,
    }
  }
}

export class ProviderRateLimiterRegistry {
  private readonly limiters = new Map<string, ProviderRateLimiter>()
  private readonly defaults: RateLimiterOptions

  constructor(defaults: RateLimiterOptions) {
    this.defaults = defaults
  }

  get(providerId: string, override?: Partial<RateLimiterOptions>): ProviderRateLimiter {
    const existing = this.limiters.get(providerId)
    if (existing) return existing
    const limiter = new ProviderRateLimiter({ ...this.defaults, ...override })
    this.limiters.set(providerId, limiter)
    return limiter
  }

  stats(): Record<string, RateLimiterStats> {
    const out: Record<string, RateLimiterStats> = {}
    for (const [id, limiter] of this.limiters) {
      out[id] = limiter.stats()
    }
    return out
  }
}
