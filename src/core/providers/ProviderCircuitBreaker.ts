/**
 * Sprint 90 — circuit breaker (CLOSED → OPEN → HALF_OPEN) with automatic recovery.
 */

import type { CircuitBreakerState } from './types'

export interface ProviderCircuitBreakerOptions {
  failureThreshold?: number
  /** How long to stay OPEN before probing HALF_OPEN. */
  openMs?: number
  /** Successes required in HALF_OPEN to return to CLOSED. */
  halfOpenSuccesses?: number
  clock?: () => number
}

export interface CircuitBreakerSnapshot {
  providerId: string
  state: CircuitBreakerState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
  recoveryCount: number
}

interface MutableCircuit {
  providerId: string
  state: CircuitBreakerState
  failures: number
  successes: number
  openedAt: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
  recoveryCount: number
}

export interface ProviderCircuitBreaker {
  snapshot(providerId: string): CircuitBreakerSnapshot
  list(): CircuitBreakerSnapshot[]
  allow(providerId: string): boolean
  recordSuccess(providerId: string): void
  recordFailure(providerId: string): void
  reset(providerId: string): void
  resetAll(): void
}

export function createProviderCircuitBreaker(
  options: ProviderCircuitBreakerOptions = {},
): ProviderCircuitBreaker {
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
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
      recoveryCount: 0,
    }
    state.set(providerId, created)
    return created
  }

  const maybeRecover = (row: MutableCircuit): void => {
    if (row.state !== 'OPEN' || row.openedAt == null) return
    if (clock() - row.openedAt >= openMs) {
      row.state = 'HALF_OPEN'
      row.successes = 0
    }
  }

  return {
    snapshot(providerId) {
      const row = ensure(providerId)
      maybeRecover(row)
      return { ...row }
    },
    list() {
      return Array.from(state.keys()).map((id) => this.snapshot(id))
    },
    allow(providerId) {
      const row = ensure(providerId)
      maybeRecover(row)
      if (row.state === 'OPEN') return false
      return true
    },
    recordSuccess(providerId) {
      const row = ensure(providerId)
      maybeRecover(row)
      row.lastSuccessAt = clock()
      if (row.state === 'HALF_OPEN') {
        row.successes += 1
        if (row.successes >= halfOpenSuccesses) {
          row.state = 'CLOSED'
          row.failures = 0
          row.successes = 0
          row.openedAt = null
          row.recoveryCount += 1
        }
        return
      }
      row.state = 'CLOSED'
      row.failures = 0
      row.successes = 0
      row.openedAt = null
    },
    recordFailure(providerId) {
      const row = ensure(providerId)
      maybeRecover(row)
      row.lastFailureAt = clock()
      if (row.state === 'HALF_OPEN') {
        row.state = 'OPEN'
        row.openedAt = clock()
        row.failures = failureThreshold
        row.successes = 0
        return
      }
      row.failures += 1
      if (row.failures >= failureThreshold) {
        row.state = 'OPEN'
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
