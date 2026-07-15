/**
 * Phase AI — circuit breaker abstraction for future provider integrations.
 * Provider-neutral; mirrors Phase W semantics without coupling to adapters.
 */

export type CircuitState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerOptions {
  failureThreshold?: number
  openMs?: number
  halfOpenSuccesses?: number
  clock?: () => number
}

export interface CircuitBreakerSnapshot {
  key: string
  state: CircuitState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
}

export interface CircuitBreaker {
  snapshot(key: string): CircuitBreakerSnapshot
  list(): CircuitBreakerSnapshot[]
  allow(key: string): boolean
  recordSuccess(key: string): void
  recordFailure(key: string): void
  reset(key: string): void
  resetAll(): void
}

interface MutableCircuit {
  key: string
  state: CircuitState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
}

export function createOpsCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 3
  const openMs = options.openMs ?? 10_000
  const halfOpenSuccesses = options.halfOpenSuccesses ?? 1
  const clock = options.clock ?? (() => Date.now())
  const state = new Map<string, MutableCircuit>()

  const ensure = (key: string): MutableCircuit => {
    const existing = state.get(key)
    if (existing) return existing
    const created: MutableCircuit = {
      key,
      state: 'closed',
      failures: 0,
      successes: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
    }
    state.set(key, created)
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
    snapshot(key) {
      const row = ensure(key)
      transitionFromOpen(row)
      return { ...row }
    },
    list() {
      return [...state.keys()].map((k) => this.snapshot(k))
    },
    allow(key) {
      const row = ensure(key)
      transitionFromOpen(row)
      if (row.state === 'open') return false
      return true
    },
    recordSuccess(key) {
      const row = ensure(key)
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
      row.failures = 0
      row.state = 'closed'
      row.openedAt = null
    },
    recordFailure(key) {
      const row = ensure(key)
      transitionFromOpen(row)
      row.lastFailureAt = clock()
      if (row.state === 'half_open') {
        row.state = 'open'
        row.openedAt = clock()
        row.successes = 0
        row.failures = failureThreshold
        return
      }
      row.failures += 1
      if (row.failures >= failureThreshold) {
        row.state = 'open'
        row.openedAt = clock()
      }
    },
    reset(key) {
      state.delete(key)
    },
    resetAll() {
      state.clear()
    },
  }
}

let defaultBreaker: CircuitBreaker | null = null

export function getOpsCircuitBreaker(): CircuitBreaker {
  if (!defaultBreaker) defaultBreaker = createOpsCircuitBreaker()
  return defaultBreaker
}

export function resetOpsCircuitBreaker(): void {
  defaultBreaker?.resetAll()
  defaultBreaker = null
}
