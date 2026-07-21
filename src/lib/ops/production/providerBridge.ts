/**
 * Sprint 65 — Bridge providerLog → StructuredLogger + ops metrics + correlation.
 */

import { getCorrelationId } from '../logging/correlation'
import { getLogger } from '../logging/structuredLogger'
import { recordProviderOutcome } from '../observability/metricsRegistry'
import {
  setProviderLogSink,
  type ProviderLogEntry,
  type ProviderLogSink,
} from '../../agent/liveProviders/providerLog'

let installed = false

export function installProviderLogBridge(): () => void {
  if (installed) return () => undefined
  installed = true

  const sink: ProviderLogSink = (entry: ProviderLogEntry) => {
    const failed = !['ok', 'empty', 'auth_retry'].includes(String(entry.status))
    recordProviderOutcome({
      providerId: entry.provider,
      durationMs: entry.durationMs,
      failed,
    })
    getLogger().info('provider', entry.operation, 'provider_request', {
      requestId: entry.requestId,
      correlationId: getCorrelationId(),
      provider: entry.provider,
      durationMs: entry.durationMs,
      status: entry.status,
      bookingId: entry.bookingId ?? null,
      providerReference: entry.providerReference ?? null,
      httpStatus: entry.httpStatus ?? null,
      detail: entry.detail ?? null,
    })
  }

  setProviderLogSink(sink)
  return () => {
    installed = false
    setProviderLogSink(null)
  }
}

export function isProviderLogBridgeInstalled(): boolean {
  return installed
}
