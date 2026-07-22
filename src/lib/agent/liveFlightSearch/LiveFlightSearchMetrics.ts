/**
 * Sprint 105 — live flight search metrics (structured, no secrets).
 */

export interface LiveFlightSearchMetricsSnapshot {
  searches: number
  successes: number
  failures: number
  validationFailures: number
  emptyResults: number
  timeouts: number
  rateLimited: number
  authFailures: number
  totalLatencyMs: number
  averageLatencyMs: number
}

export class LiveFlightSearchMetrics {
  private searches = 0
  private successes = 0
  private failures = 0
  private validationFailures = 0
  private emptyResults = 0
  private timeouts = 0
  private rateLimited = 0
  private authFailures = 0
  private totalLatencyMs = 0

  recordSearch(input: {
    ok: boolean
    latencyMs: number
    empty?: boolean
    validationFailed?: boolean
    timedOut?: boolean
    rateLimited?: boolean
    authFailure?: boolean
  }): void {
    this.searches += 1
    this.totalLatencyMs += Math.max(0, input.latencyMs)
    if (input.validationFailed) {
      this.validationFailures += 1
      this.failures += 1
      return
    }
    if (input.ok) {
      this.successes += 1
      if (input.empty) this.emptyResults += 1
      return
    }
    this.failures += 1
    if (input.empty) this.emptyResults += 1
    if (input.timedOut) this.timeouts += 1
    if (input.rateLimited) this.rateLimited += 1
    if (input.authFailure) this.authFailures += 1
  }

  snapshot(): LiveFlightSearchMetricsSnapshot {
    const searches = this.searches
    return {
      searches,
      successes: this.successes,
      failures: this.failures,
      validationFailures: this.validationFailures,
      emptyResults: this.emptyResults,
      timeouts: this.timeouts,
      rateLimited: this.rateLimited,
      authFailures: this.authFailures,
      totalLatencyMs: this.totalLatencyMs,
      averageLatencyMs: searches === 0
        ? 0
        : Math.round((this.totalLatencyMs / searches) * 100) / 100,
    }
  }

  reset(): void {
    this.searches = 0
    this.successes = 0
    this.failures = 0
    this.validationFailures = 0
    this.emptyResults = 0
    this.timeouts = 0
    this.rateLimited = 0
    this.authFailures = 0
    this.totalLatencyMs = 0
  }
}

export function createLiveFlightSearchMetrics(): LiveFlightSearchMetrics {
  return new LiveFlightSearchMetrics()
}
