import type {
  ProviderErrorCode,
  ProviderFetchResult,
  ProviderHealthSnapshot,
  ProviderHealthStatus,
} from './types'

interface MutableHealth {
  providerId: string
  consecutiveFailures: number
  consecutiveSuccesses: number
  totalRequests: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorCode: ProviderErrorCode | null
  rateLimitedUntil: string | null
}

export interface ProviderHealthTracker {
  snapshot(providerId: string): ProviderHealthSnapshot
  list(providerIds?: string[]): ProviderHealthSnapshot[]
  record(providerId: string, result: ProviderFetchResult): void
  markRateLimited(providerId: string, untilIso: string): void
  reset(providerId: string): void
}

export function createProviderHealthTracker(): ProviderHealthTracker {
  const state = new Map<string, MutableHealth>()

  const ensure = (providerId: string): MutableHealth => {
    const existing = state.get(providerId)
    if (existing) return existing
    const created: MutableHealth = {
      providerId,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
      rateLimitedUntil: null,
    }
    state.set(providerId, created)
    return created
  }

  return {
    snapshot(providerId) {
      return toSnapshot(ensure(providerId))
    },
    list(providerIds) {
      if (providerIds) return providerIds.map((id) => toSnapshot(ensure(id)))
      return [...state.values()].map(toSnapshot)
    },
    record(providerId, result) {
      const row = ensure(providerId)
      row.totalRequests += 1
      if (result.status === 'ok') {
        row.consecutiveSuccesses += 1
        row.consecutiveFailures = 0
        row.lastSuccessAt = new Date().toISOString()
        row.lastErrorCode = null
        return
      }
      row.consecutiveFailures += 1
      row.consecutiveSuccesses = 0
      row.lastFailureAt = new Date().toISOString()
      row.lastErrorCode = result.errorCode ?? null
      if (result.status === 'rate_limited') {
        const until = result.retryAfterMs
          ? new Date(Date.now() + result.retryAfterMs).toISOString()
          : new Date(Date.now() + 5_000).toISOString()
        row.rateLimitedUntil = until
      }
    },
    markRateLimited(providerId, untilIso) {
      ensure(providerId).rateLimitedUntil = untilIso
    },
    reset(providerId) {
      state.delete(providerId)
    },
  }
}

function toSnapshot(row: MutableHealth): ProviderHealthSnapshot {
  return {
    providerId: row.providerId,
    status: deriveStatus(row),
    consecutiveFailures: row.consecutiveFailures,
    consecutiveSuccesses: row.consecutiveSuccesses,
    totalRequests: row.totalRequests,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    lastErrorCode: row.lastErrorCode,
    rateLimitedUntil: row.rateLimitedUntil,
  }
}

function deriveStatus(row: MutableHealth): ProviderHealthStatus {
  if (row.rateLimitedUntil && Date.parse(row.rateLimitedUntil) > Date.now()) {
    return 'degraded'
  }
  if (row.totalRequests === 0) return 'unknown'
  if (row.consecutiveFailures >= 3) return 'unhealthy'
  if (row.consecutiveFailures >= 1) return 'degraded'
  return 'healthy'
}

export function isProviderHealthyEnough(
  health: ProviderHealthSnapshot,
  options: { excludeUnhealthy?: boolean } = {},
): boolean {
  if (health.rateLimitedUntil && Date.parse(health.rateLimitedUntil) > Date.now()) {
    return false
  }
  if (options.excludeUnhealthy === false) return true
  return health.status !== 'unhealthy'
}
