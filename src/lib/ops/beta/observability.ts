/**
 * Sprint 67 — beta observability activation (uses existing ops metrics/timers).
 */

import { getCorrelationId, createCorrelationId, setCorrelationId } from '../logging/correlation'
import { getLogger } from '../logging/structuredLogger'
import { getOpsMetrics } from '../observability/metricsRegistry'
import { installProviderLogBridge } from '../production/providerBridge'
import { recordDomainTiming } from '../production/timers'

export interface BetaObservabilityHandle {
  correlationId: string
  dispose: () => void
  recordSearchLatency: (ms: number, ok?: boolean) => void
  recordBookingSuccess: (ok: boolean, ms?: number) => void
  recordProviderLatency: (providerId: string, ms: number, failed?: boolean) => void
  recordTripLifecycle: (event: string, ms?: number) => void
}

/** Enable structured logging bridge + correlation for beta sessions. */
export function enableBetaObservability(): BetaObservabilityHandle {
  const correlationId = getCorrelationId() || createCorrelationId()
  setCorrelationId(correlationId)
  const disposeBridge = installProviderLogBridge()
  getLogger().info('beta', 'observability', 'beta_observability_enabled', { correlationId })

  return {
    correlationId,
    dispose: () => disposeBridge(),
    recordSearchLatency(ms, ok = true) {
      recordDomainTiming('search', 'beta_search', ms, { correlationId }, ok)
    },
    recordBookingSuccess(ok, ms = 0) {
      recordDomainTiming('booking', 'beta_booking', ms, { correlationId, ok: String(ok) }, ok)
      if (!ok) getOpsMetrics().incr('booking.lifecycle_failures', { source: 'beta' })
    },
    recordProviderLatency(providerId, ms, failed = false) {
      recordDomainTiming('provider', 'beta_provider', ms, { providerId, correlationId }, !failed)
    },
    recordTripLifecycle(event, ms = 0) {
      recordDomainTiming('trip', event, ms, { correlationId }, true)
      getOpsMetrics().incr('trip.count', { event })
    },
  }
}

export function snapshotBetaMetrics(): {
  counters: Record<string, number>
  gauges: Record<string, number>
  samples: number
} {
  const snap = getOpsMetrics().snapshot()
  return {
    counters: snap.counters,
    gauges: snap.gauges,
    samples: snap.recent.length,
  }
}
