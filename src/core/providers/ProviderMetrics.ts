/**
 * Sprint 90 — provider metrics (availability, latency, success/failure, recovery).
 */

export interface ProviderMetricsSnapshot {
  providerId: string
  requests: number
  successes: number
  failures: number
  timeouts: number
  totalLatencyMs: number
  averageLatencyMs: number
  successRate: number
  failureRate: number
  availability: number
  recoveryCount: number
  lastError: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
}

interface MutableMetrics {
  providerId: string
  requests: number
  successes: number
  failures: number
  timeouts: number
  totalLatencyMs: number
  recoveryCount: number
  lastError: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
}

function toSnapshot(row: MutableMetrics): ProviderMetricsSnapshot {
  const requests = row.requests
  const averageLatencyMs = requests === 0 ? 0 : row.totalLatencyMs / requests
  const successRate = requests === 0 ? 0 : row.successes / requests
  const failureRate = requests === 0 ? 0 : row.failures / requests
  return {
    providerId: row.providerId,
    requests,
    successes: row.successes,
    failures: row.failures,
    timeouts: row.timeouts,
    totalLatencyMs: row.totalLatencyMs,
    averageLatencyMs: Math.round(averageLatencyMs * 100) / 100,
    successRate: Math.round(successRate * 10_000) / 10_000,
    failureRate: Math.round(failureRate * 10_000) / 10_000,
    availability: Math.round(successRate * 10_000) / 10_000,
    recoveryCount: row.recoveryCount,
    lastError: row.lastError,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
  }
}

export interface ProviderMetricsStore {
  recordSuccess(providerId: string, latencyMs: number): void
  recordFailure(providerId: string, latencyMs: number, error?: string, timedOut?: boolean): void
  recordRecovery(providerId: string): void
  snapshot(providerId: string): ProviderMetricsSnapshot
  list(): ProviderMetricsSnapshot[]
  reset(providerId?: string): void
}

export function createProviderMetricsStore(): ProviderMetricsStore {
  const state = new Map<string, MutableMetrics>()

  const ensure = (providerId: string): MutableMetrics => {
    const existing = state.get(providerId)
    if (existing) return existing
    const created: MutableMetrics = {
      providerId,
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      totalLatencyMs: 0,
      recoveryCount: 0,
      lastError: null,
      lastSuccessAt: null,
      lastFailureAt: null,
    }
    state.set(providerId, created)
    return created
  }

  return {
    recordSuccess(providerId, latencyMs) {
      const row = ensure(providerId)
      row.requests += 1
      row.successes += 1
      row.totalLatencyMs += Math.max(0, latencyMs)
      row.lastSuccessAt = new Date().toISOString()
    },
    recordFailure(providerId, latencyMs, error, timedOut) {
      const row = ensure(providerId)
      row.requests += 1
      row.failures += 1
      if (timedOut) row.timeouts += 1
      row.totalLatencyMs += Math.max(0, latencyMs)
      row.lastError = error ?? 'unknown'
      row.lastFailureAt = new Date().toISOString()
    },
    recordRecovery(providerId) {
      ensure(providerId).recoveryCount += 1
    },
    snapshot(providerId) {
      return toSnapshot(ensure(providerId))
    },
    list() {
      return Array.from(state.values()).map(toSnapshot)
    },
    reset(providerId) {
      if (providerId) state.delete(providerId)
      else state.clear()
    },
  }
}
