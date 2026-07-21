/**
 * Sprint 71 — Health monitoring for provider runtime adapters.
 */

import type { CircuitBreaker } from '../aggregation/liveIntegration/circuitBreaker'
import type {
  ProviderRuntimeHealth,
  ProviderRuntimeId,
  ProviderRuntimeMode,
} from './types'

export type ProviderHealthCounters = {
  latencySum: number
  latencyCount: number
  successes: number
  failures: number
  retries: number
  quotaUsed: number
  quotaLimit: number
}

export class ProviderRuntimeHealthMonitor {
  private readonly counters = new Map<ProviderRuntimeId, ProviderHealthCounters>()
  private readonly modes = new Map<ProviderRuntimeId, ProviderRuntimeMode>()
  private readonly breaker: CircuitBreaker | undefined

  constructor(breaker?: CircuitBreaker) {
    this.breaker = breaker
  }

  private ensure(id: ProviderRuntimeId): ProviderHealthCounters {
    let c = this.counters.get(id)
    if (!c) {
      c = {
        latencySum: 0,
        latencyCount: 0,
        successes: 0,
        failures: 0,
        retries: 0,
        quotaUsed: 0,
        quotaLimit: 100,
      }
      this.counters.set(id, c)
    }
    return c
  }

  setMode(id: ProviderRuntimeId, mode: ProviderRuntimeMode): void {
    this.modes.set(id, mode)
  }

  recordSuccess(id: ProviderRuntimeId, latencyMs: number): void {
    const c = this.ensure(id)
    c.successes += 1
    c.latencySum += latencyMs
    c.latencyCount += 1
    c.quotaUsed += 1
  }

  recordFailure(id: ProviderRuntimeId, latencyMs = 0, retried = false): void {
    const c = this.ensure(id)
    c.failures += 1
    if (latencyMs > 0) {
      c.latencySum += latencyMs
      c.latencyCount += 1
    }
    if (retried) c.retries += 1
    c.quotaUsed += 1
  }

  snapshot(id: ProviderRuntimeId, available: boolean): ProviderRuntimeHealth {
    const c = this.ensure(id)
    const total = Math.max(1, c.successes + c.failures)
    const latencyMs = c.latencyCount ? Math.round(c.latencySum / c.latencyCount) : 0
    const availability = c.successes / total
    const circuit = this.breaker?.snapshot(id)
    const mode = this.modes.get(id) ?? (available ? 'live' : 'unavailable')
    return {
      providerId: id,
      available,
      mode,
      latencyMs,
      availability,
      failures: c.failures,
      retries: c.retries,
      quotaUsed: c.quotaUsed,
      quotaLimit: c.quotaLimit,
      circuitState: circuit?.state ?? 'closed',
      detail: `${mode}; latency=${latencyMs}ms; fail=${c.failures}; retry=${c.retries}`,
    }
  }
}
