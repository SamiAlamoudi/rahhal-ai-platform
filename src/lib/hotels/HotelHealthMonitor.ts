/**
 * Sprint 30 — Hotel provider health monitoring.
 */

import type {
  HotelHealthSnapshot,
  HotelHealthStatus,
  HotelProviderErrorCode,
  HotelProviderId,
} from './types'

const DEFAULT_DEGRADED_AFTER = 2
const DEFAULT_UNHEALTHY_AFTER = 4

export class HotelHealthMonitor {
  private readonly snapshots = new Map<HotelProviderId, HotelHealthSnapshot>()
  private readonly degradedAfter: number
  private readonly unhealthyAfter: number

  constructor(options?: { degradedAfter?: number; unhealthyAfter?: number }) {
    this.degradedAfter = options?.degradedAfter ?? DEFAULT_DEGRADED_AFTER
    this.unhealthyAfter = options?.unhealthyAfter ?? DEFAULT_UNHEALTHY_AFTER
  }

  get(providerId: HotelProviderId): HotelHealthSnapshot {
    return this.snapshots.get(providerId) ?? emptySnapshot(providerId)
  }

  list(): HotelHealthSnapshot[] {
    return [...this.snapshots.values()].map((s) => ({ ...s }))
  }

  recordSuccess(providerId: HotelProviderId, latencyMs: number): HotelHealthSnapshot {
    const prev = this.get(providerId)
    const next: HotelHealthSnapshot = {
      ...prev,
      consecutiveFailures: 0,
      consecutiveSuccesses: prev.consecutiveSuccesses + 1,
      totalRequests: prev.totalRequests + 1,
      totalSuccesses: prev.totalSuccesses + 1,
      lastLatencyMs: latencyMs,
      lastSuccessAt: new Date().toISOString(),
      lastErrorCode: null,
      rateLimitedUntil: null,
      status: 'healthy',
    }
    this.snapshots.set(providerId, next)
    return { ...next }
  }

  recordFailure(
    providerId: HotelProviderId,
    code: HotelProviderErrorCode,
    options?: { latencyMs?: number; rateLimitedUntil?: string | null },
  ): HotelHealthSnapshot {
    const prev = this.get(providerId)
    const consecutiveFailures = prev.consecutiveFailures + 1
    const next: HotelHealthSnapshot = {
      ...prev,
      consecutiveFailures,
      consecutiveSuccesses: 0,
      totalRequests: prev.totalRequests + 1,
      totalFailures: prev.totalFailures + 1,
      lastLatencyMs: options?.latencyMs ?? prev.lastLatencyMs,
      lastFailureAt: new Date().toISOString(),
      lastErrorCode: code,
      rateLimitedUntil: options?.rateLimitedUntil ?? (code === 'rate_limited' ? prev.rateLimitedUntil : null),
      status: statusFromFailures(consecutiveFailures, this.degradedAfter, this.unhealthyAfter),
    }
    this.snapshots.set(providerId, next)
    return { ...next }
  }

  isHealthyEnough(providerId: HotelProviderId): boolean {
    const snap = this.get(providerId)
    if (snap.rateLimitedUntil && Date.parse(snap.rateLimitedUntil) > Date.now()) {
      return false
    }
    return snap.status !== 'unhealthy'
  }

  reset(providerId?: HotelProviderId): void {
    if (providerId) {
      this.snapshots.delete(providerId)
      return
    }
    this.snapshots.clear()
  }
}

function statusFromFailures(
  consecutiveFailures: number,
  degradedAfter: number,
  unhealthyAfter: number,
): HotelHealthStatus {
  if (consecutiveFailures >= unhealthyAfter) return 'unhealthy'
  if (consecutiveFailures >= degradedAfter) return 'degraded'
  if (consecutiveFailures === 0) return 'healthy'
  return 'degraded'
}

function emptySnapshot(providerId: HotelProviderId): HotelHealthSnapshot {
  return {
    providerId,
    status: 'unknown',
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    totalRequests: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    lastLatencyMs: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastErrorCode: null,
    rateLimitedUntil: null,
  }
}

let sharedHealthMonitor: HotelHealthMonitor | null = null

export function getHotelHealthMonitor(): HotelHealthMonitor {
  if (!sharedHealthMonitor) sharedHealthMonitor = new HotelHealthMonitor()
  return sharedHealthMonitor
}

export function resetHotelHealthMonitor(): void {
  sharedHealthMonitor?.reset()
  sharedHealthMonitor = null
}
