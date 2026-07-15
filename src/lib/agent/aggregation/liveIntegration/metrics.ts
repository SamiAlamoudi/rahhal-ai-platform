/**
 * Phase W — in-memory provider metrics (no external export required).
 */

export interface ProviderMetricCounters {
  providerId: string
  requests: number
  successes: number
  failures: number
  timeouts: number
  rateLimited: number
  retries: number
  fallbacks: number
  totalDurationMs: number
  lastDurationMs: number | null
}

export interface ProviderMetrics {
  recordRequest(providerId: string, input: {
    status: 'ok' | 'error' | 'timeout' | 'rate_limited' | 'skipped'
    durationMs?: number
    retries?: number
    fallback?: boolean
  }): void
  snapshot(providerId?: string): ProviderMetricCounters[]
  reset(providerId?: string): void
}

function empty(providerId: string): ProviderMetricCounters {
  return {
    providerId,
    requests: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    rateLimited: 0,
    retries: 0,
    fallbacks: 0,
    totalDurationMs: 0,
    lastDurationMs: null,
  }
}

export function createProviderMetrics(): ProviderMetrics {
  const rows = new Map<string, ProviderMetricCounters>()

  const ensure = (providerId: string): ProviderMetricCounters => {
    const existing = rows.get(providerId)
    if (existing) return existing
    const created = empty(providerId)
    rows.set(providerId, created)
    return created
  }

  return {
    recordRequest(providerId, input) {
      const row = ensure(providerId)
      row.requests += 1
      if (input.status === 'ok') row.successes += 1
      else if (input.status === 'timeout') row.timeouts += 1
      else if (input.status === 'rate_limited') row.rateLimited += 1
      else if (input.status !== 'skipped') row.failures += 1
      if (input.retries) row.retries += input.retries
      if (input.fallback) row.fallbacks += 1
      if (typeof input.durationMs === 'number') {
        row.totalDurationMs += input.durationMs
        row.lastDurationMs = input.durationMs
      }
    },
    snapshot(providerId) {
      if (providerId) return [{ ...ensure(providerId) }]
      return [...rows.values()].map((r) => ({ ...r }))
    },
    reset(providerId) {
      if (providerId) rows.delete(providerId)
      else rows.clear()
    },
  }
}
