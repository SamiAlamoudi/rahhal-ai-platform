/**
 * Phase W — circuit breaker (closed → open → half-open).
 */

export type CircuitState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerOptions {
  /** Failures in the rolling window before opening. */
  failureThreshold?: number
  /** Open duration before probing half-open. */
  openMs?: number
  /** Successes in half-open required to close. */
  halfOpenSuccesses?: number
  clock?: () => number
}

export interface CircuitBreakerSnapshot {
  providerId: string
  state: CircuitState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
}

export interface CircuitBreaker {
  snapshot(providerId: string): CircuitBreakerSnapshot
  list(): CircuitBreakerSnapshot[]
  /** Whether a call is allowed. */
  allow(providerId: string): boolean
  recordSuccess(providerId: string): void
  recordFailure(providerId: string): void
  reset(providerId: string): void
  resetAll(): void
}

interface MutableCircuit {
  providerId: string
  state: CircuitState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
}

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 3
  const openMs = options.openMs ?? 10_000
  const halfOpenSuccesses = options.halfOpenSuccesses ?? 1
  const clock = options.clock ?? (() => Date.now())
  const state = new Map<string, MutableCircuit>()

  const ensure = (providerId: string): MutableCircuit => {
    const existing = state.get(providerId)
    if (existing) return existing
    const created: MutableCircuit = {
      providerId,
      state: 'closed',
      failures: 0,
      successes: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
    }
    state.set(providerId, created)
    return created
  }

  const transitionFromOpen = (row: MutableCircuit): void => {
    if (row.state !== 'open' || row.openedAt == null) return
    if (clock() - row.openedAt >= openMs) {
      row.state = 'half_open'
      row.successes = 0
    }
  }

  return {
    snapshot(providerId) {
      const row = ensure(providerId)
      transitionFromOpen(row)
      return { ...row }
    },
    list() {
      return [...state.keys()].map((id) => this.snapshot(id))
    },
    allow(providerId) {
      const row = ensure(providerId)
      transitionFromOpen(row)
      if (row.state === 'open') return false
      return true
    },
    recordSuccess(providerId) {
      const row = ensure(providerId)
      transitionFromOpen(row)
      row.lastSuccessAt = clock()
      if (row.state === 'half_open') {
        row.successes += 1
        if (row.successes >= halfOpenSuccesses) {
          row.state = 'closed'
          row.failures = 0
          row.successes = 0
          row.openedAt = null
        }
        return
      }
      row.state = 'closed'
      row.failures = 0
      row.successes += 1
    },
    recordFailure(providerId) {
      const row = ensure(providerId)
      transitionFromOpen(row)
      row.lastFailureAt = clock()
      row.failures += 1
      row.successes = 0
      if (row.state === 'half_open' || row.failures >= failureThreshold) {
        row.state = 'open'
        row.openedAt = clock()
      }
    },
    reset(providerId) {
      state.delete(providerId)
    },
    resetAll() {
      state.clear()
    },
  }
}
