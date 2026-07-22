/**
 * Sprint 104 — gateway metrics facade over Sprint 90 ProviderMetricsStore.
 * Avoids duplicating metrics algorithms.
 */

import {
  createProviderMetricsStore,
  type ProviderMetricsSnapshot,
  type ProviderMetricsStore,
} from '../providers'
import type { GatewayOperation, GatewayProviderId } from './types'

export interface GatewayMetricsRecord {
  providerId: GatewayProviderId
  operation: GatewayOperation
  ok: boolean
  latencyMs: number
  timedOut?: boolean
  error?: string | null
}

export class GatewayMetrics {
  constructor(private readonly store: ProviderMetricsStore = createProviderMetricsStore()) {}

  record(entry: GatewayMetricsRecord): void {
    const key = `${entry.providerId}:${entry.operation}`
    if (entry.ok) {
      this.store.recordSuccess(key, entry.latencyMs)
    } else {
      this.store.recordFailure(
        key,
        entry.latencyMs,
        entry.error ?? undefined,
        entry.timedOut,
      )
    }
  }

  snapshot(providerId: GatewayProviderId, operation: GatewayOperation): ProviderMetricsSnapshot {
    return this.store.snapshot(`${providerId}:${operation}`)
  }

  list(): ProviderMetricsSnapshot[] {
    return this.store.list()
  }

  reset(): void {
    this.store.reset()
  }
}

export function createGatewayMetrics(
  store?: ProviderMetricsStore,
): GatewayMetrics {
  return new GatewayMetrics(store)
}
